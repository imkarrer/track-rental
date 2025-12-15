import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { toDateStringUTC, toUTCStartOfDay } from "@/lib/date/format"

const reservationSchema = z.object({
  trackId: z.string(),
  eventDate: z.string(),
  endDate: z.string().nullable().optional(),
  startTime: z.string(),
  endTime: z.string(),
  eventAddress: z.string(),
  eventCity: z.string(),
  eventState: z.string(),
  eventZip: z.string(),
  availableSpaceLength: z.number(),
  availableSpaceWidth: z.number(),
  selectedCars: z.array(z.object({
    carId: z.string(),
    quantity: z.number(),
  })),
  pricing: z.object({
    basePrice: z.number(),
    dayMultiplier: z.number(),
    durationMultiplier: z.number(),
    distanceSurcharge: z.number(),
    setupFee: z.number(),
    freeCarsIncluded: z.number(),
    additionalCarsCount: z.number(),
    additionalCarsPrice: z.number(),
    subtotal: z.number(),
    tax: z.number(),
    total: z.number(),
    dayOfWeek: z.number(),
    durationHours: z.number(),
    distanceFromBase: z.number().nullable().optional(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = reservationSchema.parse(body)

    // Clean up expired reservations first
    await prisma.reservation.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    // PROTECTION 1: Limit active reservations per user (prevent reservation hoarding)
    const userActiveReservations = await prisma.reservation.count({
      where: {
        userId: session.user.id,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    // Allow max 3 active reservations per user at a time
    const MAX_ACTIVE_RESERVATIONS = 3
    if (userActiveReservations >= MAX_ACTIVE_RESERVATIONS) {
      return NextResponse.json(
        { 
          error: `You can only have ${MAX_ACTIVE_RESERVATIONS} active reservations at a time. Please complete or cancel your existing reservations before creating a new one.`,
          tooManyReservations: true,
        },
        { status: 429 } // Too Many Requests
      )
    }

    // PROTECTION 2: Rate limiting - prevent rapid reservation creation
    // Check how many reservations user created in last 5 minutes
    const recentReservations = await prisma.reservation.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    })

    const MAX_RESERVATIONS_PER_5_MIN = 5
    if (recentReservations >= MAX_RESERVATIONS_PER_5_MIN) {
      return NextResponse.json(
        { 
          error: "You're creating reservations too quickly. Please wait a few minutes before trying again.",
          rateLimited: true,
        },
        { status: 429 }
      )
    }

    // Use string dates for comparison to avoid timezone issues with @db.Date fields
    const eventDateStr = data.eventDate // Already YYYY-MM-DD format
    const endDateStr = data.endDate || eventDateStr

    // Check for conflicts with existing reservations
    // Fetch all active reservations and filter in JS to avoid timezone comparison issues
    const activeReservations = await prisma.reservation.findMany({
      where: {
        trackId: data.trackId,
        expiresAt: { gt: new Date() }, // Only check active (non-expired) reservations
      },
      select: {
        id: true,
        userId: true,
        eventDate: true,
        endDate: true,
        expiresAt: true,
      },
    })
    
    // Find matching reservation using string comparison to avoid timezone issues
    const existingReservation = activeReservations.find((res) => {
      const resStartStr = toDateStringUTC(res.eventDate)!
      const resEndStr = toDateStringUTC(res.endDate || res.eventDate)!
      
      // Check for overlap: reservation overlaps if ranges intersect
      return !(resEndStr < eventDateStr || resStartStr > endDateStr)
    })

    if (existingReservation) {
      // Check if it's the same user (they can renew their own reservation)
      if (existingReservation.userId !== session.user.id) {
        return NextResponse.json(
          {
            error: "This date is currently reserved by another customer. Please try a different date.",
            reservedUntil: existingReservation.expiresAt,
          },
          { status: 409 }
        )
      } else {
        // Same user - delete old reservation and create new one
        await prisma.reservation.delete({
          where: { id: existingReservation.id },
        })
      }
    }

    // Check for conflicts with confirmed bookings
    // Fetch all bookings and filter in JS to avoid timezone comparison issues with @db.Date
    const bookings = await prisma.booking.findMany({
      where: {
        trackId: data.trackId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: {
        id: true,
        eventDate: true,
        endDate: true,
      },
    })
    
    // Find matching booking using string comparison to avoid timezone issues
    const existingBooking = bookings.find((booking) => {
      const bookingStartStr = toDateStringUTC(booking.eventDate)!
      const bookingEndStr = toDateStringUTC(booking.endDate || booking.eventDate)!
      
      // Check for overlap: booking overlaps if ranges intersect
      return !(bookingEndStr < eventDateStr || bookingStartStr > endDateStr)
    })

    if (existingBooking) {
      return NextResponse.json(
        { error: "This date is already booked. Please select a different date." },
        { status: 409 }
      )
    }

    // Create reservation (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    // Convert string dates to Date objects for database storage (using UTC to avoid timezone shifts)
    const eventDate = toUTCStartOfDay(eventDateStr)
    const endDate = endDateStr !== eventDateStr ? toUTCStartOfDay(endDateStr) : null

    const reservation = await prisma.reservation.create({
      data: {
        userId: session.user.id,
        trackId: data.trackId,
        eventDate: eventDate,
        endDate: endDate,
        startTime: data.startTime,
        endTime: data.endTime,
        durationHours: data.pricing.durationHours,
        eventAddress: data.eventAddress,
        eventCity: data.eventCity,
        eventState: data.eventState,
        eventZip: data.eventZip,
        availableSpaceLength: data.availableSpaceLength,
        availableSpaceWidth: data.availableSpaceWidth,
        distanceFromBase: data.pricing.distanceFromBase,
        dayOfWeek: data.pricing.dayOfWeek,
        basePrice: data.pricing.basePrice,
        dayMultiplier: data.pricing.dayMultiplier,
        durationMultiplier: data.pricing.durationMultiplier,
        distanceSurcharge: data.pricing.distanceSurcharge,
        setupFee: data.pricing.setupFee,
        freeCarsIncluded: data.pricing.freeCarsIncluded,
        additionalCarsCount: data.pricing.additionalCarsCount,
        additionalCarsPrice: data.pricing.additionalCarsPrice,
        subtotal: data.pricing.subtotal,
        tax: data.pricing.tax,
        total: data.pricing.total,
        selectedCars: data.selectedCars as any,
        expiresAt,
      },
    })

    return NextResponse.json({
      reservation: {
        id: reservation.id,
        expiresAt: reservation.expiresAt,
        expiresInSeconds: Math.floor((reservation.expiresAt.getTime() - Date.now()) / 1000),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues)
      const errorMessage = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      return NextResponse.json(
        { error: `Validation failed: ${errorMessage}`, details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error creating reservation:", error)
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    )
  }
}

