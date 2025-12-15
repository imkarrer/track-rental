import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { calculatePricing, calculateDurationHours } from "@/lib/pricing/calculate"
import { calculateMultiDayPricing } from "@/lib/pricing/multi-day"
import { calculateDistance } from "@/lib/distance/calculate"
import { validateTrackFitsInSpace } from "@/lib/validation/space"
import { getDayOrHolidayMultiplier } from "@/lib/pricing/holidays"
import { toUTCDate } from "@/lib/date/format"

const bookingSchema = z.object({
  trackId: z.string().uuid(),
  eventDate: z.string(),
  endDate: z.string().optional().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  eventAddress: z.string(),
  eventCity: z.string(),
  eventState: z.string(),
  eventZip: z.string(),
  availableSpaceLength: z.number().positive(),
  availableSpaceWidth: z.number().positive(),
  selectedCars: z.array(
    z.object({
      carId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      console.error("User not found in database:", session.user.id)
      return NextResponse.json(
        { error: "User account not found. Please log in again." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = bookingSchema.parse(body)

    // Fetch track
    const track = await prisma.track.findUnique({
      where: { id: validatedData.trackId },
    })

    if (!track || !track.isActive) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 })
    }

    // Validate space
    const spaceValidation = validateTrackFitsInSpace(
      Number(track.length),
      Number(track.width),
      validatedData.availableSpaceLength,
      validatedData.availableSpaceWidth
    )

    if (!spaceValidation.fits) {
      return NextResponse.json(
        { error: spaceValidation.message },
        { status: 400 }
      )
    }

    // Calculate distance
    const distanceResult = await calculateDistance(
      validatedData.eventAddress,
      validatedData.eventCity,
      validatedData.eventState,
      validatedData.eventZip
    )

    // Fetch cars and calculate pricing
    const cars = await prisma.car.findMany({
      where: {
        id: { in: validatedData.selectedCars.map((sc) => sc.carId) },
      },
    })

    const carsWithPrices = validatedData.selectedCars
      .map((selected) => {
        const car = cars.find((c) => c.id === selected.carId)
        return car
          ? {
              carId: selected.carId,
              basePricePerDay: Number(car.basePricePerDay),
              quantity: selected.quantity,
            }
          : null
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    const eventDateObj = toUTCDate(validatedData.eventDate)
    const endDateObj = validatedData.endDate ? toUTCDate(validatedData.endDate) : null
    if (!eventDateObj) {
      return NextResponse.json({ error: "Invalid event date" }, { status: 400 })
    }
    const isMultiDay = endDateObj && endDateObj > eventDateObj

    // Calculate pricing - handle multi-day bookings
    let pricing: any
    if (isMultiDay) {
      const multiDayPricing = await calculateMultiDayPricing({
        trackBasePrice: Number(track.basePrice),
        startDate: eventDateObj!,
        endDate: endDateObj!,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        setupTimeMinutes: track.setupTimeMinutes,
        distanceFromBase: distanceResult.distanceMiles,
        selectedCars: carsWithPrices,
      })
      pricing = {
        ...multiDayPricing,
        dayOfWeek: eventDateObj.getDay(),
        dayMultiplier: 1.0, // Multi-day uses per-day multipliers
        durationMultiplier: 1.0, // Duration multiplier is per day
        trackBasePrice: Number(track.basePrice),
        trackPrice: multiDayPricing.totalTrackPrice,
      }
    } else {
      // Get day multiplier (handles holidays automatically)
      const dayMultiplier = await getDayOrHolidayMultiplier(eventDateObj)

      pricing = calculatePricing({
        trackBasePrice: Number(track.basePrice),
        eventDate: eventDateObj,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        setupTimeMinutes: track.setupTimeMinutes,
        distanceFromBase: distanceResult.distanceMiles,
        selectedCars: carsWithPrices,
        dayMultiplier,
      })
    }

    // Validate pricing has all required fields
    if (!pricing || !pricing.subtotal || !pricing.tax || !pricing.total) {
      console.error("Invalid pricing result:", pricing)
      return NextResponse.json(
        { error: "Failed to calculate pricing. Please try again." },
        { status: 500 }
      )
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: user.id, // Use the verified user from database
        trackId: validatedData.trackId,
        eventDate: eventDateObj,
        endDate: endDateObj,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        durationHours: pricing.durationHours || calculateDurationHours(validatedData.startTime, validatedData.endTime),
        eventAddress: validatedData.eventAddress,
        eventCity: validatedData.eventCity,
        eventState: validatedData.eventState,
        eventZip: validatedData.eventZip,
        availableSpaceLength: validatedData.availableSpaceLength,
        availableSpaceWidth: validatedData.availableSpaceWidth,
        distanceFromBase: distanceResult.distanceMiles,
        dayOfWeek: pricing.dayOfWeek || eventDateObj.getDay(),
        basePrice: pricing.trackBasePrice || Number(track.basePrice),
        dayMultiplier: pricing.dayMultiplier || 1.0,
        durationMultiplier: pricing.durationMultiplier || 1.0,
        distanceSurcharge: pricing.distanceSurcharge,
        setupFee: pricing.setupFee,
        freeCarsIncluded: pricing.freeCarsIncluded ?? 2,
        additionalCarsCount: pricing.additionalCarsCount ?? 0,
        additionalCarsPrice: pricing.additionalCarsPrice ?? 0,
        subtotal: Number(pricing.subtotal),
        tax: Number(pricing.tax),
        total: Number(pricing.total),
        status: "PENDING",
        bookingCars: {
          create: (() => {
            // Allocate free cars across all selected cars
            let remainingFree = pricing.freeCarsIncluded ?? 2
            const bookingCars = []

            for (const selected of validatedData.selectedCars) {
              const car = cars.find((c) => c.id === selected.carId)!
              const dayMult = pricing.dayMultiplier || 1.0
              const durationMult = pricing.durationMultiplier || 1.0
              const unitPrice = Number(car.basePricePerDay) * dayMult * durationMult
              
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

              bookingCars.push({
                carId: selected.carId,
                quantity: selected.quantity,
                isFree: freeQuantity === selected.quantity,
                unitPrice,
                totalPrice: unitPrice * paidQuantity,
              })
            }

            return bookingCars
          })(),
        },
      },
      include: {
        track: true,
        bookingCars: {
          include: {
            car: true,
          },
        },
      },
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors)
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating booking:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create booking"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

