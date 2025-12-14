import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { convertReservationToBooking } from "@/lib/reservations/convert-to-booking"
import { sendBookingNotifications } from "@/lib/notifications/send"
import { z } from "zod"

/**
 * Fallback endpoint to check if webhook created booking, and if not, create it
 * This respects the webhook as primary source of truth but provides a safety net
 */

const schema = z.object({
  reservationId: z.string().uuid(),
  paymentIntentId: z.string(),
  customerInfo: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    billingAddress: z.string(),
    billingCity: z.string(),
    billingState: z.string(),
    billingZip: z.string(),
  }),
  smsOptIn: z.boolean().optional(),
  emailOptOut: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = schema.parse(body)

    // First, check if webhook already created the booking
    const existingBooking = await prisma.booking.findFirst({
      where: {
        OR: [
          { reservationId: validatedData.reservationId },
          { paymentIntentId: validatedData.paymentIntentId },
        ],
      },
      include: {
        user: true,
        track: true,
        bookingCars: {
          include: {
            car: true,
          },
        },
      },
    })

    if (existingBooking) {
      console.log("✅ Webhook already created booking:", existingBooking.id)
      return NextResponse.json({
        booking: existingBooking,
        source: "webhook",
        message: "Booking already confirmed by webhook",
      })
    }

    // Check if reservation still exists
    const reservation = await prisma.reservation.findUnique({
      where: { id: validatedData.reservationId },
    })

    if (!reservation) {
      console.log("⚠️ Reservation not found - checking if booking was just created...")
      
      // Race condition: webhook may have just created booking between our checks
      // Check one more time
      const bookingJustCreated = await prisma.booking.findFirst({
        where: {
          OR: [
            { reservationId: validatedData.reservationId },
            { paymentIntentId: validatedData.paymentIntentId },
          ],
        },
        include: {
          user: true,
          track: true,
          bookingCars: {
            include: {
              car: true,
            },
          },
        },
      })

      if (bookingJustCreated) {
        console.log("✅ Found booking created by webhook during check:", bookingJustCreated.id)
        return NextResponse.json({
          booking: bookingJustCreated,
          source: "webhook",
          message: "Booking was created by webhook",
        })
      }

      return NextResponse.json({
        error: "Reservation not found and no booking exists",
        source: "error",
      }, { status: 404 })
    }

    console.log("⚠️ Webhook hasn't created booking yet, creating via fallback...")

    // Webhook didn't create booking, so we create it as fallback
    const booking = await convertReservationToBooking(validatedData.reservationId)

    // Verify booking belongs to the user
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update booking with payment intent and status
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Create history entry
      await tx.bookingHistory.create({
        data: {
          bookingId: booking.id,
          actionType: "CREATED",
          performedBy: session.user.id,
          performedByRole: session.user.role || "USER",
          newEventDate: booking.eventDate,
          newEndDate: booking.endDate,
          newTotal: booking.total,
          newStatus: "CONFIRMED",
          reason: "Booking created via fallback (webhook didn't fire in time)",
          metadata: {
            paymentIntentId: validatedData.paymentIntentId,
            smsOptIn: validatedData.smsOptIn ?? false,
            emailOptOut: validatedData.emailOptOut ?? false,
            source: "fallback",
          },
        },
      })

      // Update the booking
      return await tx.booking.update({
        where: { id: booking.id },
        data: {
          paymentIntentId: validatedData.paymentIntentId,
          status: "CONFIRMED",
          phone: validatedData.customerInfo.phone ?? "",
          smsOptIn: validatedData.smsOptIn ?? false,
          emailOptOut: validatedData.emailOptOut ?? false,
          confirmationSource: "fallback", // Mark that fallback was used
        },
        include: {
          user: true,
          track: true,
          bookingCars: {
            include: {
              car: true,
            },
          },
        },
      })
    })

    // Send notifications
    await sendBookingNotifications({
      booking: updatedBooking as any,
      customerInfo: validatedData.customerInfo,
    })

    console.log("✅ Booking created via fallback:", updatedBooking.id)

    return NextResponse.json({
      booking: updatedBooking,
      source: "fallback",
      message: "Booking created by fallback mechanism",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error in check-or-confirm:", error)
    return NextResponse.json(
      { error: "Failed to check or confirm booking" },
      { status: 500 }
    )
  }
}
