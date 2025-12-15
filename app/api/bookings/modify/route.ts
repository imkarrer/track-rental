import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/stripe/config"
import { z } from "zod"
import { toUTCStartOfDay, toDateStringUTC } from "@/lib/date/format"
import { getAvailableWeeks } from "@/lib/availability/check"
import { calculateRefundPercent } from "@/lib/booking/refund-calculator"
import { calculateMultiDayPricing } from "@/lib/pricing/multi-day"
import { calculatePricing } from "@/lib/pricing/calculate"
import { getDayOrHolidayMultiplier, getDayMultiplierDetails } from "@/lib/pricing/holidays"
import { calculateModifyFinancials } from "@/lib/booking/modify-calculator"

const modifySchema = z.object({
  bookingId: z.string().uuid(),
  newEventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  selectedCars: z.array(
    z.object({
      carId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ).optional(),
})

/**
 * POST /api/bookings/modify
 * 
 * Calculate the pricing for modifying a booking (date and/or cars).
 * Returns the difference and what action is needed (payment/refund).
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { bookingId, newEventDate, newEndDate, selectedCars } = modifySchema.parse(body)

    // 1. Fetch the existing booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        track: true,
        bookingCars: {
          include: {
            car: true,
          },
        },
      },
    })
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    
    // Fetch day multipliers and refund policies globally
    const [dayMultipliers, refundPolicies] = await Promise.all([
      prisma.dayMultiplier.findMany(),
      prisma.refundPolicy.findMany({
        where: { isActive: true },
        orderBy: { daysBeforeService: "desc" },
      }),
    ])

    // Security: ensure user owns this booking
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Business rule: only confirmed bookings can be modified
    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Only confirmed bookings can be modified" },
        { status: 400 }
      )
    }

    // 2. Check if new date is available
    const newEventDateUTC = toUTCStartOfDay(newEventDate)
    const newEndDateUTC = newEndDate ? toUTCStartOfDay(newEndDate) : null

    // Check if dates are in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (newEventDateUTC < today) {
      return NextResponse.json(
        { error: "Cannot modify to a past date" },
        { status: 400 }
      )
    }

    // Check availability for the new date(s)
    // Exclude current booking AND allow this user's active reservations
    const { availableDays } = await getAvailableWeeks(
      booking.trackId,
      newEventDate,
      newEndDate || newEventDate,
      bookingId,            // Exclude current booking from availability check
      session.user.id       // Allow this user's active reservations
    )

    const newEventDateStr = newEventDate
    if (!availableDays[newEventDateStr]) {
      return NextResponse.json(
        { error: "Selected date is not available" },
        { status: 400 }
      )
    }

    // 3. Determine if old booking was multi-day
    const wasMultiDay = !!(booking.endDate && booking.endDate > booking.eventDate)
    const oldEventDateStr = toDateStringUTC(booking.eventDate)
    const oldEndDateStr = booking.endDate ? toDateStringUTC(booking.endDate) : null
    
    // 4. Determine if new booking will be multi-day
    const willBeMultiDay = !!(newEndDate && newEndDateUTC !== null && newEndDateUTC > newEventDateUTC)

    // 5. Get existing car selection for old pricing calculation
    const oldCarsWithPrices = booking.bookingCars.map((bc) => ({
      carId: bc.carId,
      basePricePerDay: Number(bc.car.basePricePerDay),
      quantity: bc.quantity,
    }))

    // 6. Calculate OLD booking total (recalculate to be accurate for multi-day)
    // Use track's base price (booking.basePrice might be 0 if stored incorrectly)
    const basePrice = Number(booking.track.basePrice)
    const oldTaxRate = Number(booking.tax) / (Number(booking.subtotal) || 1)
    
    let oldCalculatedPricing: any
    let oldDayMultiplier = 1.0
    let oldDayName = ""

    if (wasMultiDay) {
      // Recalculate using multi-day pricing (excluding setup/distance as they were already paid)
      oldCalculatedPricing = await calculateMultiDayPricing({
        trackBasePrice: basePrice,
        startDate: booking.eventDate,
        endDate: booking.endDate!,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0, // Already paid
        distanceFromBase: 0, // Already paid
        selectedCars: oldCarsWithPrices,
        taxRate: oldTaxRate,
      })
      // For multi-day, use the multiplier of the start date
      const oldDayDetails = await getDayMultiplierDetails(booking.eventDate)
      oldDayMultiplier = oldDayDetails.multiplier
      oldDayName = oldDayDetails.dayName
    } else {
      // Single day - recalculate with stored data
      const oldDayDetails = await getDayMultiplierDetails(booking.eventDate)
      oldDayMultiplier = oldDayDetails.multiplier
      oldDayName = oldDayDetails.dayName
      oldCalculatedPricing = calculatePricing({
        trackBasePrice: basePrice,
        eventDate: booking.eventDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: oldCarsWithPrices,
        dayMultiplier: oldDayMultiplier,
        taxRate: oldTaxRate,
      })
    }

    const oldCalculatedTotal = oldCalculatedPricing.total

    // 7. Get new cars selection
    let newCarsWithPrices = oldCarsWithPrices // Default to same cars
    
    if (selectedCars && selectedCars.length > 0) {
      const carIds = selectedCars.map(sc => sc.carId)
      const cars = await prisma.car.findMany({
        where: { id: { in: carIds } },
      })
      
      newCarsWithPrices = selectedCars.map((selected) => {
        const car = cars.find(c => c.id === selected.carId)
        return car ? {
          carId: selected.carId,
          basePricePerDay: Number(car.basePricePerDay),
          quantity: selected.quantity,
        } : null
      }).filter((c): c is NonNullable<typeof c> => c !== null)
    }

    // 8. Calculate NEW booking total
    let newCalculatedPricing: any
    let newDayMultiplier = 1.0
    let newDayName = ""

    if (willBeMultiDay) {
      // Use multi-day pricing
      newCalculatedPricing = await calculateMultiDayPricing({
        trackBasePrice: basePrice,
        startDate: newEventDateUTC,
        endDate: newEndDateUTC!,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0, // Already paid
        distanceFromBase: 0, // Already paid
        selectedCars: newCarsWithPrices,
        taxRate: oldTaxRate,
      })
      // For multi-day, use the multiplier of the start date
      const newDayDetails = await getDayMultiplierDetails(newEventDateUTC)
      newDayMultiplier = newDayDetails.multiplier
      newDayName = newDayDetails.dayName
    } else {
      // Single day
      const newDayDetails = await getDayMultiplierDetails(newEventDateUTC)
      newDayMultiplier = newDayDetails.multiplier
      newDayName = newDayDetails.dayName
      newCalculatedPricing = calculatePricing({
        trackBasePrice: basePrice,
        eventDate: newEventDateUTC,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: newCarsWithPrices,
        dayMultiplier: newDayMultiplier,
        taxRate: oldTaxRate,
      })
    }

    const newCalculatedTotal = newCalculatedPricing.total

    // 9. Calculate modification financials using the new algorithm
    // Algorithm:
    // 1. Check if promo code was used, honor it throughout
    // 2. First, do a soft refund according to the refund policy
    // 3. Then, charge for the new day(s) according to day multiplier
    // 4. Compute the final price
    const daysUntilOriginalEvent = Math.floor(
      (booking.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    const modifyFinancials = calculateModifyFinancials(
      {
        oldTotal: oldCalculatedTotal,
        oldPromoDiscount: Number(booking.referralDiscount || 0),
        oldEventDate: oldEventDateStr!,
        oldEndDate: oldEndDateStr,
        newTotal: newCalculatedTotal,
        newEventDate: newEventDateStr,
        newEndDate: newEndDate || null,
        refundPolicies,
        daysUntilOriginalEvent,
      },
      booking.referralCode || null
    )

    // Log calculation for debugging/audit
    console.log("Booking modification calculation:", {
      bookingId,
      userId: session.user.id,
      oldEventDate: toDateStringUTC(booking.eventDate),
      newEventDate,
      daysUntilEvent: daysUntilOriginalEvent,
      calculation: {
        oldTotal: oldCalculatedTotal,
        newTotal: newCalculatedTotal,
        promoCode: booking.referralCode,
        promoDiscount: modifyFinancials.promoDiscount,
        refundPercent: modifyFinancials.refundablePercent,
        creditAmount: modifyFinancials.creditAmount,
        newChargeAmount: modifyFinancials.newChargeAmount,
        action: modifyFinancials.action,
        actionAmount: modifyFinancials.actionAmount,
      }
    })

    // Extract values from the calculation
    const action = modifyFinancials.action
    const amount = modifyFinancials.actionAmount
    const refundPercent = modifyFinancials.refundablePercent
    const oldTotalWithPromo = modifyFinancials.oldTotalWithPromo
    const newTotalWithPromo = modifyFinancials.newTotalWithPromo
    const promoDiscount = modifyFinancials.promoDiscount

    // 10. Calculate duration change info
    const oldDays = wasMultiDay ? 
      Math.ceil((booking.endDate!.getTime() - booking.eventDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1
    const newDays = willBeMultiDay ?
      Math.ceil((newEndDateUTC.getTime() - newEventDateUTC.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1

    // 11. Calculate car change info
    const oldAdditionalCarsCount = booking.additionalCarsCount
    const newTotalCarQuantity = newCarsWithPrices.reduce((sum, c) => sum + c.quantity, 0)
    const newAdditionalCarsCount = Math.max(0, newTotalCarQuantity - 2)

    // 12. Build a detailed breakdown for the frontend to display
    const breakdown = {
      old: {
        trackPrice: oldCalculatedPricing.trackPrice,
        additionalCarsPrice: oldCalculatedPricing.additionalCarsPrice,
        distanceSurcharge: oldCalculatedPricing.distanceSurcharge,
        tax: oldCalculatedPricing.tax,
        subtotal: oldCalculatedPricing.subtotal,
        total: oldCalculatedPricing.total,
        promoDiscount,
        totalWithPromo: oldTotalWithPromo,
      },
      new: {
        trackPrice: newCalculatedPricing.trackPrice,
        additionalCarsPrice: newCalculatedPricing.additionalCarsPrice,
        distanceSurcharge: newCalculatedPricing.distanceSurcharge,
        tax: newCalculatedPricing.tax,
        subtotal: newCalculatedPricing.subtotal,
        total: newCalculatedPricing.total,
        promoDiscount,
        totalWithPromo: newTotalWithPromo,
      },
      deltas: {
        trackPrice: newCalculatedPricing.trackPrice - oldCalculatedPricing.trackPrice,
        additionalCarsPrice: newCalculatedPricing.additionalCarsPrice - oldCalculatedPricing.additionalCarsPrice,
        distanceSurcharge: newCalculatedPricing.distanceSurcharge - oldCalculatedPricing.distanceSurcharge,
        tax: newCalculatedPricing.tax - oldCalculatedPricing.tax,
        subtotal: newCalculatedPricing.subtotal - oldCalculatedPricing.subtotal,
        total: newCalculatedPricing.total - oldCalculatedPricing.total,
        totalWithPromo: newTotalWithPromo - oldTotalWithPromo,
      },
    }

    return NextResponse.json({
      success: true,
      oldEventDate: oldEventDateStr!,
      oldEndDate: oldEndDateStr,
      newEventDate: newEventDateStr,
      newEndDate: newEndDate || null,
      oldDays,
      newDays,
      oldTotal: oldTotalWithPromo,
      newTotal: newTotalWithPromo,
      oldMultiplier: oldDayMultiplier,
      newMultiplier: newDayMultiplier,
      oldDayName: oldDayName,
      newDayName: newDayName,
      action,
      amount,
      refundPercent,
      promoCode: booking.referralCode,
      promoCodePreserved: !!booking.referralCode,
      oldAdditionalCarsCount,
      newAdditionalCarsCount,
      wasMultiDay,
      willBeMultiDay,
      daysUntilOriginalEvent,
      breakdown,
      // Include detailed calculation breakdown for transparency
      modifyCalculation: {
        hasPromoCode: modifyFinancials.hasPromoCode,
        isExtension: modifyFinancials.isExtension,
        softRefundAmount: modifyFinancials.softRefundAmount,
        creditAmount: modifyFinancials.creditAmount,
        newChargeAmount: modifyFinancials.newChargeAmount,
        netDifference: modifyFinancials.netDifference,
        refundablePercent: modifyFinancials.refundablePercent,
        nonRefundablePercent: modifyFinancials.nonRefundablePercent,
      },
    })
  } catch (error) {
    console.error("Error calculating booking modification:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/bookings/modify
 * 
 * Confirm and execute the booking modification.
 */
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { bookingId, newEventDate, newEndDate, reservationId, paymentIntentId, selectedCars } = z
      .object({
        bookingId: z.string().uuid(),
        newEventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        reservationId: z.string().uuid().optional(), // Reservation for new date
        paymentIntentId: z.string().optional(), // For payment if upgrading
        selectedCars: z.array(
          z.object({
            carId: z.string().uuid(),
            quantity: z.number().int().min(1),
          })
        ).optional(),
      })
      .parse(body)

    // Re-fetch and validate (same as POST)
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        track: true,
        bookingCars: {
          include: {
            car: true,
          },
        },
      },
    })
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    
    // Fetch day multipliers and refund policies globally
    const [dayMultipliers, refundPolicies] = await Promise.all([
      prisma.dayMultiplier.findMany(),
      prisma.refundPolicy.findMany({
        where: { isActive: true },
        orderBy: { daysBeforeService: "desc" },
      }),
    ])

    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Only confirmed bookings can be modified" },
        { status: 400 }
      )
    }

    const newEventDateUTC = toUTCStartOfDay(newEventDate)
    const newEndDateUTC = newEndDate ? toUTCStartOfDay(newEndDate) : null

    // Recalculate everything (same as POST) using multi-day aware logic
    const wasMultiDay = !!(booking.endDate && booking.endDate > booking.eventDate)
    const willBeMultiDay = !!(newEndDate && newEndDateUTC !== null && newEndDateUTC > newEventDateUTC)

    // Get existing car selection
    const oldCarsWithPrices = booking.bookingCars.map((bc) => ({
      carId: bc.carId,
      basePricePerDay: Number(bc.car.basePricePerDay),
      quantity: bc.quantity,
    }))

    // Get new cars selection
    let newCarsWithPrices = oldCarsWithPrices
    
    if (selectedCars && selectedCars.length > 0) {
      const carIds = selectedCars.map(sc => sc.carId)
      const cars = await prisma.car.findMany({
        where: { id: { in: carIds } },
      })
      
      newCarsWithPrices = selectedCars.map((selected) => {
        const car = cars.find(c => c.id === selected.carId)
        return car ? {
          carId: selected.carId,
          basePricePerDay: Number(car.basePricePerDay),
          quantity: selected.quantity,
        } : null
      }).filter((c): c is NonNullable<typeof c> => c !== null)
    }

    // Calculate OLD booking total
    // Use track's base price (booking.basePrice might be 0 if stored incorrectly)
    const basePrice = Number(booking.track.basePrice)
    const oldTaxRate = Number(booking.tax) / (Number(booking.subtotal) || 1)
    
    let oldCalculatedPricing: any

    if (wasMultiDay) {
      oldCalculatedPricing = await calculateMultiDayPricing({
        trackBasePrice: basePrice,
        startDate: booking.eventDate,
        endDate: booking.endDate!,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: oldCarsWithPrices,
        taxRate: oldTaxRate,
      })
    } else {
      const oldDayMultiplier = await getDayOrHolidayMultiplier(booking.eventDate)
      oldCalculatedPricing = calculatePricing({
        trackBasePrice: basePrice,
        eventDate: booking.eventDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: oldCarsWithPrices,
        dayMultiplier: oldDayMultiplier,
        taxRate: oldTaxRate,
      })
    }

    // Calculate NEW booking total
    let newCalculatedPricing: any

    if (willBeMultiDay) {
      newCalculatedPricing = await calculateMultiDayPricing({
        trackBasePrice: basePrice,
        startDate: newEventDateUTC,
        endDate: newEndDateUTC!,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: newCarsWithPrices,
        taxRate: oldTaxRate,
      })
    } else {
      const newDayMultiplier = await getDayOrHolidayMultiplier(newEventDateUTC)
      newCalculatedPricing = calculatePricing({
        trackBasePrice: basePrice,
        eventDate: newEventDateUTC,
        startTime: booking.startTime,
        endTime: booking.endTime,
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: newCarsWithPrices,
        dayMultiplier: newDayMultiplier,
        taxRate: oldTaxRate,
      })
    }

    // Apply promo code discount
    const promoDiscount = Number(booking.referralDiscount || 0)
    const oldTotalWithPromo = oldCalculatedPricing.total - promoDiscount
    const newTotalWithPromo = newCalculatedPricing.total - promoDiscount
    
    // Calculate modification financials using the algorithm
    const daysUntilOriginalEvent = Math.floor(
      (booking.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    const modifyFinancials = calculateModifyFinancials(
      {
        oldTotal: oldCalculatedPricing.total,
        oldPromoDiscount: promoDiscount,
        oldEventDate: toDateStringUTC(booking.eventDate) || "",
        oldEndDate: booking.endDate ? toDateStringUTC(booking.endDate) || null : null,
        newTotal: newCalculatedPricing.total,
        newEventDate: newEventDate,
        newEndDate: newEndDate || null,
        refundPolicies,
        daysUntilOriginalEvent,
      },
      booking.referralCode || null
    )

    // Log calculation for execution/audit
    console.log("Executing booking modification:", {
      bookingId,
      userId: session.user.id,
      oldEventDate: toDateStringUTC(booking.eventDate),
      newEventDate,
      calculation: {
        action: modifyFinancials.action,
        actionAmount: modifyFinancials.actionAmount,
        finalBookingTotal: modifyFinancials.finalBookingTotal,
        refundPercent: modifyFinancials.refundablePercent,
      }
    })

    // Calculate new values for database update
    const newSubtotal = newCalculatedPricing.subtotal
    const newTax = newCalculatedPricing.tax
    const newTotal = modifyFinancials.finalBookingTotal
    
    const newAdditionalCarsCount = Math.max(0, newCarsWithPrices.reduce((sum, c) => sum + c.quantity, 0) - 2)

    // Handle refunds or payments BEFORE updating the booking
    let stripeRefundId: string | null = null
    let stripePaymentIntentId: string | null = null

    // Use the calculated action and amount from the algorithm
    const action = modifyFinancials.action
    const totalRefundAmount = action === "refund" ? modifyFinancials.actionAmount : 0
    const totalPaymentNeeded = action === "payment" ? modifyFinancials.actionAmount : 0
    const refundPercent = modifyFinancials.refundablePercent

    // Process refund if needed
    if (totalRefundAmount > 0 && booking.paymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: booking.paymentIntentId,
          amount: Math.round(totalRefundAmount * 100),
          reason: "requested_by_customer",
          metadata: {
            bookingId: booking.id,
            reason: "booking_modification",
            oldDate: toDateStringUTC(booking.eventDate) || "",
            oldEndDate: booking.endDate ? toDateStringUTC(booking.endDate) || "" : "",
            newDate: newEventDate,
            newEndDate: newEndDate || "",
            refundPercent: refundPercent.toString(),
            wasMultiDay: wasMultiDay.toString(),
            willBeMultiDay: willBeMultiDay.toString(),
          },
        })

        stripeRefundId = refund.id
        console.log("📤 MODIFICATION REFUND ISSUED:", {
          bookingId,
          refundId: refund.id,
          amount: `$${totalRefundAmount.toFixed(2)}`,
          refundPercent: `${refundPercent}%`,
          oldTotal: `$${oldTotalWithPromo.toFixed(2)}`,
          newTotal: `$${newTotalWithPromo.toFixed(2)}`,
          creditAmount: `$${modifyFinancials.creditAmount.toFixed(2)}`,
        })
      } catch (error) {
        console.error("Failed to process Stripe refund:", error)
        return NextResponse.json(
          { error: "Failed to process refund. Please contact support." },
          { status: 500 }
        )
      }
    }
    
    // Process payment if needed
    if (totalPaymentNeeded > 0) {
      // Payment required
      if (!paymentIntentId) {
        return NextResponse.json(
          { error: "Payment required for upgrade" },
          { status: 400 }
        )
      }

      try {
        // Verify the payment was completed
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

        if (paymentIntent.status !== "succeeded") {
          return NextResponse.json(
            { error: "Payment not completed" },
            { status: 400 }
          )
        }

        // Verify the amount matches
        const expectedAmount = Math.round(totalPaymentNeeded * 100)
        if (paymentIntent.amount !== expectedAmount) {
          console.error("Payment amount mismatch:", {
            expected: expectedAmount,
            received: paymentIntent.amount,
          })
          return NextResponse.json(
            { error: "Payment amount mismatch" },
            { status: 400 }
          )
        }

        stripePaymentIntentId = paymentIntent.id
        console.log("Booking modification payment verified:", {
          bookingId,
          paymentIntentId: paymentIntent.id,
          amount: totalPaymentNeeded,
        })
      } catch (error) {
        console.error("Failed to verify payment:", error)
        return NextResponse.json(
          { error: "Failed to verify payment. Please contact support." },
          { status: 500 }
        )
      }
    }

    // Update the booking and clean up reservation
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Calculate additional cars price from new pricing
      const newAdditionalCarsPrice = willBeMultiDay 
        ? newCalculatedPricing.totalAdditionalCarsPrice 
        : newCalculatedPricing.additionalCarsPrice

      // Determine action type based on what changed
      let actionType: "MODIFIED_DATE" | "MODIFIED_CARS" | "MODIFIED_BOTH" = "MODIFIED_DATE"
      const carsChanged = selectedCars && selectedCars.length > 0
      
      if (carsChanged && (newEventDate !== toDateStringUTC(booking.eventDate) || newEndDate !== (booking.endDate ? toDateStringUTC(booking.endDate) : null))) {
        actionType = "MODIFIED_BOTH"
      } else if (carsChanged) {
        actionType = "MODIFIED_CARS"
      }

      // Create refund record for audit trail if refund was issued
      if (totalRefundAmount > 0 && stripeRefundId) {
        await tx.refund.create({
          data: {
            bookingId,
            amount: totalRefundAmount,
            refundType: "PARTIAL", // Modification refunds are always partial (based on policy)
            reason: "Booking modification - date/time change",
            circumstances: `Rescheduled from ${toDateStringUTC(booking.eventDate)} to ${newEventDate}`,
            stripeRefundId,
            processedBy: session.user.id,
            notes: `Automatic refund during booking modification. Refund policy: ${refundPercent}% refundable. Credit amount: $${modifyFinancials.creditAmount.toFixed(2)}, New charge: $${modifyFinancials.newChargeAmount.toFixed(2)}`,
          },
        })
      }

      // Create history entry before updating
      await tx.bookingHistory.create({
        data: {
          bookingId,
          actionType,
          performedBy: session.user.id,
          performedByRole: session.user.role || "USER",
          oldEventDate: booking.eventDate,
          oldEndDate: booking.endDate,
          oldTotal: booking.total,
          oldStatus: booking.status,
          newEventDate: newEventDateUTC,
          newEndDate: newEndDateUTC,
          newTotal,
          newStatus: booking.status, // Status doesn't change during modification
          refundAmount: totalRefundAmount > 0 ? totalRefundAmount : null,
          paymentAmount: totalPaymentNeeded > 0 ? totalPaymentNeeded : null,
          refundPercent: totalRefundAmount > 0 ? refundPercent : null,
          reason: "Customer requested booking modification",
          metadata: {
            wasMultiDay,
            willBeMultiDay,
            oldDays: wasMultiDay ? Math.ceil((booking.endDate!.getTime() - booking.eventDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1,
            newDays: willBeMultiDay ? Math.ceil((newEndDateUTC.getTime() - newEventDateUTC.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1,
            oldAdditionalCarsCount: booking.additionalCarsCount,
            newAdditionalCarsCount,
            promoCodePreserved: !!booking.referralCode,
            stripeRefundId,
            stripePaymentIntentId,
            calculation: {
              action: modifyFinancials.action,
              creditAmount: modifyFinancials.creditAmount,
              newChargeAmount: modifyFinancials.newChargeAmount,
              netDifference: modifyFinancials.netDifference,
            }
          }
        }
      })

      // Update the booking
      // IMPORTANT: Track refunds from modification to prevent over-refunding later
      const previouslyRefunded = Number(booking.totalRefunded) || 0
      const newTotalRefunded = previouslyRefunded + totalRefundAmount
      
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          eventDate: newEventDateUTC,
          endDate: newEndDateUTC,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
          additionalCarsCount: newAdditionalCarsCount,
          additionalCarsPrice: newAdditionalCarsPrice,
          // Store multipliers (average for multi-day, exact for single day)
          dayMultiplier: willBeMultiDay ? 1.0 : (newCalculatedPricing.dayMultiplier || 1.0),
          durationMultiplier: newCalculatedPricing.durationMultiplier || 1.0,
          // Preserve promo code
          referralCode: booking.referralCode,
          referralDiscount: booking.referralDiscount,
          // Track total refunded amount (including modification refunds)
          // This prevents admin from over-refunding when issuing full refund later
          totalRefunded: newTotalRefunded,
        },
      })

      // Update car selection if provided
      if (selectedCars && selectedCars.length > 0) {
        // Delete existing booking cars
        await tx.bookingCar.deleteMany({
          where: { bookingId },
        })

        // Fetch car details for the new selection
        const carIds = selectedCars.map(sc => sc.carId)
        const cars = await tx.car.findMany({
          where: { id: { in: carIds } },
        })

        // Create new booking cars with updated pricing
        let remainingFree = 2
        
        for (const selected of selectedCars) {
          const car = cars.find(c => c.id === selected.carId)
          if (!car) continue

          // Calculate average unit price (for multi-day) or exact price (for single day)
          let unitPrice: number
          if (willBeMultiDay) {
            // Average price across all days for this car type
            const totalDays = newCalculatedPricing.days.length
            unitPrice = newCalculatedPricing.days.reduce((sum: number, day: any) => {
              return sum + (Number(car.basePricePerDay) * Number(day.multiplier))
            }, 0) / totalDays
          } else {
            unitPrice = Number(car.basePricePerDay) * (newCalculatedPricing.dayMultiplier || 1.0) * (newCalculatedPricing.durationMultiplier || 1.0)
          }

          let freeQuantity = 0
          let paidQuantity = 0

          // Allocate free slots to this car
          for (let i = 0; i < selected.quantity; i++) {
            if (remainingFree > 0) {
              remainingFree--
              freeQuantity++
            } else {
              paidQuantity++
            }
          }

          await tx.bookingCar.create({
            data: {
              bookingId,
              carId: selected.carId,
              quantity: selected.quantity,
              isFree: freeQuantity === selected.quantity,
              unitPrice,
              totalPrice: unitPrice * paidQuantity,
            },
          })
        }
      }

      // Delete the temporary reservation if provided
      if (reservationId) {
        await tx.reservation.delete({
          where: { id: reservationId },
        }).catch(() => {
          // Reservation might have expired, that's okay
          console.log("Reservation already deleted:", reservationId)
        })
      }

      return updated
    })

    return NextResponse.json({
      success: true,
      booking: {
        id: updatedBooking.id,
        eventDate: updatedBooking.eventDate.toISOString().split("T")[0],
        total: Number(updatedBooking.total),
      },
    })
  } catch (error) {
    console.error("Error executing booking modification:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
