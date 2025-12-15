import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { toUTCStartOfDay } from "@/lib/date/format"
import { getAvailableWeeks } from "@/lib/availability/check"

const rescheduleReservationSchema = z.object({
  bookingId: z.string().uuid(),
  trackId: z.string().uuid(),
  newEventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  selectedCars: z
    .array(
      z.object({
        carId: z.string().uuid(),
        quantity: z.number().int().min(1),
      })
    )
    .optional(),
})

/**
 * POST /api/reservations/reschedule
 * 
 * Create a temporary reservation for a new date during reschedule flow.
 * This prevents others from booking the new date while the user completes reschedule.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { bookingId, trackId, newEventDate, newEndDate, selectedCars } =
      rescheduleReservationSchema.parse(body)

    // Verify user owns the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingCars: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Only confirmed bookings can be rescheduled" },
        { status: 400 }
      )
    }

    // Check if new date is available
    const newEventDateUTC = toUTCStartOfDay(newEventDate)
    const newEndDateUTC = newEndDate ? toUTCStartOfDay(newEndDate) : null

    // Check if dates are in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (newEventDateUTC < today) {
      return NextResponse.json(
        { error: "Cannot reschedule to a past date" },
        { status: 400 }
      )
    }

    // Build selected cars payload for reservation reuse/creation
    const selectedCarsPayload =
      selectedCars && selectedCars.length > 0
        ? selectedCars
        : booking.bookingCars.map((bc) => ({
            carId: bc.carId,
            quantity: bc.quantity,
          }))

    // Check availability (excluding the current booking)
    const { availableDays } = await getAvailableWeeks(
      trackId,
      newEventDate,
      newEndDate || newEventDate,
      bookingId,            // exclude current booking
      session.user.id       // allow this user's active holds
    )

    const newEventDateStr = newEventDate
    if (!availableDays[newEventDateStr]) {
      return NextResponse.json(
        { error: "Selected date is not available" },
        { status: 400 }
      )
    }

    // Prevent duplicate active reservation on same track/date
    const existingReservation = await prisma.reservation.findFirst({
      where: {
        trackId,
        eventDate: newEventDateUTC,
        endDate: newEndDateUTC,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingReservation) {
      // If another customer holds it, block
      if (existingReservation.userId !== session.user.id) {
        return NextResponse.json(
          {
            error: "This date is currently reserved by another customer. Please try a different date.",
            reservedUntil: existingReservation.expiresAt,
          },
          { status: 409 }
        )
      }
      // Same user: extend and reuse reservation
      const extended = await prisma.reservation.update({
        where: { id: existingReservation.id },
        data: {
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          selectedCars: selectedCarsPayload as any,
        },
      })
      return NextResponse.json({
        reservationId: extended.id,
        expiresAt: extended.expiresAt.toISOString(),
      })
    }

    // Create a temporary reservation for the new date
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    try {
      const reservation = await prisma.reservation.create({
        data: {
          userId: session.user.id,
          trackId,
          eventDate: newEventDateUTC,
          endDate: newEndDateUTC,
          startTime: booking.startTime,
          endTime: booking.endTime,
          durationHours: booking.durationHours,
          eventAddress: booking.eventAddress,
          eventCity: booking.eventCity,
          eventState: booking.eventState,
          eventZip: booking.eventZip,
          availableSpaceLength: booking.availableSpaceLength,
          availableSpaceWidth: booking.availableSpaceWidth,
          distanceFromBase: booking.distanceFromBase,
          dayOfWeek: newEventDateUTC.getUTCDay(),
          basePrice: booking.basePrice,
          dayMultiplier: booking.dayMultiplier,
          durationMultiplier: booking.durationMultiplier,
          distanceSurcharge: booking.distanceSurcharge,
          setupFee: booking.setupFee,
          freeCarsIncluded: booking.freeCarsIncluded,
          additionalCarsCount: booking.additionalCarsCount,
          additionalCarsPrice: booking.additionalCarsPrice,
          subtotal: booking.subtotal,
          tax: booking.tax,
          total: booking.total,
          referralCode: booking.referralCode,
          referralDiscount: booking.referralDiscount,
          selectedCars: selectedCarsPayload as any,
          expiresAt,
        },
      })

      return NextResponse.json({
        reservationId: reservation.id,
        expiresAt: reservation.expiresAt.toISOString(),
      })
    } catch (error: any) {
      // Handle unique constraint race: reuse existing reservation if ours, otherwise report conflict
      if (error?.code === "P2002") {
        const conflicting = await prisma.reservation.findFirst({
          where: {
            trackId,
            eventDate: newEventDateUTC,
            endDate: newEndDateUTC,
            expiresAt: { gt: new Date() },
          },
        })

        if (conflicting) {
          if (conflicting.userId === session.user.id) {
            const extended = await prisma.reservation.update({
              where: { id: conflicting.id },
              data: {
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                selectedCars: selectedCarsPayload as any,
              },
            })
            return NextResponse.json({
              reservationId: extended.id,
              expiresAt: extended.expiresAt.toISOString(),
            })
          }

          return NextResponse.json(
            {
              error: "This date is currently reserved by another customer. Please try a different date.",
              reservedUntil: conflicting.expiresAt,
            },
            { status: 409 }
          )
        }

        return NextResponse.json(
          { error: "Selected date is not available" },
          { status: 409 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error("Error creating reschedule reservation:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

