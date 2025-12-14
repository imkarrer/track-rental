import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { toDateStringUTC } from "@/lib/date/format"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        track: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
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

    // Security: ensure user owns this booking or is admin
    if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({
      id: booking.id,
      trackId: booking.trackId,
      trackName: booking.track.name,
      trackCategory: booking.track.category,
      eventDate: toDateStringUTC(booking.eventDate),
      endDate: booking.endDate ? toDateStringUTC(booking.endDate) : null,
      basePrice: Number(booking.basePrice),
      total: Number(booking.total),
      referralCode: booking.referralCode,
      referralDiscount: Number(booking.referralDiscount || 0),
      status: booking.status,
      freeCarsIncluded: booking.freeCarsIncluded,
      additionalCarsCount: booking.additionalCarsCount,
      additionalCarsPrice: Number(booking.additionalCarsPrice),
      bookingCars: booking.bookingCars.map((bc) => ({
        carId: bc.carId,
        carName: bc.car.name,
        carType: bc.car.type,
        quantity: bc.quantity,
        isFree: bc.isFree,
        unitPrice: Number(bc.unitPrice),
        totalPrice: Number(bc.totalPrice),
      })),
    })
  } catch (error) {
    console.error("Error fetching booking:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

