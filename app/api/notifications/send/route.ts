import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { sendBookingNotifications } from "@/lib/notifications/send"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bookingId } = body

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        track: true,
        bookingCars: {
          include: { car: true },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    await sendBookingNotifications({
      booking: booking as any,
      customerInfo: {
        firstName: booking.user.firstName,
        lastName: booking.user.lastName,
        email: booking.user.email,
        phone: booking.phone || "",
        billingAddress: booking.billingAddress || "",
        billingCity: booking.billingCity || "",
        billingState: booking.billingState || "",
        billingZip: booking.billingZip || "",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending notifications:", error)
    return NextResponse.json({ error: "Failed to send notifications" }, { status: 500 })
  }
}

