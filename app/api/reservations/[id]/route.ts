import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

// GET - Check reservation status and extend if needed
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
      include: {
        track: true,
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    // Check if reservation belongs to user
    if (reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check if expired
    if (reservation.expiresAt < new Date()) {
      return NextResponse.json(
        {
          error: "Reservation expired",
          expired: true,
        },
        { status: 410 }
      )
    }

    const expiresInSeconds = Math.floor(
      (reservation.expiresAt.getTime() - Date.now()) / 1000
    )

    return NextResponse.json({
      reservation: {
        id: reservation.id,
        trackId: reservation.trackId,
        eventDate: reservation.eventDate,
        endDate: reservation.endDate,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        eventAddress: reservation.eventAddress,
        eventCity: reservation.eventCity,
        eventState: reservation.eventState,
        eventZip: reservation.eventZip,
        availableSpaceLength: reservation.availableSpaceLength,
        availableSpaceWidth: reservation.availableSpaceWidth,
        selectedCars: reservation.selectedCars,
        expiresAt: reservation.expiresAt,
        expiresInSeconds,
        total: Number(reservation.total),
      },
    })
  } catch (error) {
    console.error("Error fetching reservation:", error)
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    )
  }
}

// DELETE - Cancel reservation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    if (reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await prisma.reservation.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting reservation:", error)
    return NextResponse.json(
      { error: "Failed to delete reservation" },
      { status: 500 }
    )
  }
}

// PATCH - Update reservation with car selection and pricing
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    if (reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check if expired
    if (reservation.expiresAt < new Date()) {
      return NextResponse.json(
        {
          error: "Reservation expired",
          expired: true,
        },
        { status: 410 }
      )
    }

    const body = await request.json()
    const { selectedCars, pricing } = body

    // Update reservation
    const updatedReservation = await prisma.reservation.update({
      where: { id: params.id },
      data: {
        selectedCars: selectedCars || reservation.selectedCars,
        basePrice: pricing?.basePrice !== undefined ? pricing.basePrice : reservation.basePrice,
        dayMultiplier: pricing?.dayMultiplier !== undefined ? pricing.dayMultiplier : reservation.dayMultiplier,
        durationMultiplier: pricing?.durationMultiplier !== undefined ? pricing.durationMultiplier : reservation.durationMultiplier,
        distanceSurcharge: pricing?.distanceSurcharge !== undefined ? pricing.distanceSurcharge : reservation.distanceSurcharge,
        setupFee: pricing?.setupFee !== undefined ? pricing.setupFee : reservation.setupFee,
        freeCarsIncluded: pricing?.freeCarsIncluded !== undefined ? pricing.freeCarsIncluded : reservation.freeCarsIncluded,
        additionalCarsCount: pricing?.additionalCarsCount !== undefined ? pricing.additionalCarsCount : reservation.additionalCarsCount,
        additionalCarsPrice: pricing?.additionalCarsPrice !== undefined ? pricing.additionalCarsPrice : reservation.additionalCarsPrice,
        subtotal: pricing?.subtotal !== undefined ? pricing.subtotal : reservation.subtotal,
        tax: pricing?.tax !== undefined ? pricing.tax : reservation.tax,
        total: pricing?.total !== undefined ? pricing.total : reservation.total,
      },
    })

    return NextResponse.json({
      reservation: {
        id: updatedReservation.id,
        expiresAt: updatedReservation.expiresAt,
      },
    })
  } catch (error) {
    console.error("Error updating reservation:", error)
    return NextResponse.json(
      { error: "Failed to update reservation" },
      { status: 500 }
    )
  }
}

