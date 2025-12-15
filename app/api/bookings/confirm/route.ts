import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { convertReservationToBooking } from "@/lib/reservations/convert-to-booking"
import { sendBookingNotifications } from "@/lib/notifications/send"

const confirmBookingSchema = z.object({
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
    const validatedData = confirmBookingSchema.parse(body)

    // Convert reservation to booking
    const booking = await convertReservationToBooking(validatedData.reservationId)

    // Verify booking belongs to the user
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update booking with payment intent and status, and create history entry
    const updateData: any = {
      paymentIntentId: validatedData.paymentIntentId,
      status: "CONFIRMED",
      phone: validatedData.customerInfo.phone ?? "",
      smsOptIn: validatedData.smsOptIn ?? false,
      emailOptOut: validatedData.emailOptOut ?? false,
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Create history entry for booking creation
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
          reason: "Booking created and payment confirmed",
          metadata: {
            paymentIntentId: validatedData.paymentIntentId,
            smsOptIn: validatedData.smsOptIn ?? false,
            emailOptOut: validatedData.emailOptOut ?? false,
            referralCode: booking.referralCode,
            referralDiscount: booking.referralDiscount ? Number(booking.referralDiscount) : 0,
          }
        }
      })

      // Update the booking
      return await tx.booking.update({
        where: { id: booking.id },
        data: updateData,
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

    // Send notifications (email + SMS if opted)
    await sendBookingNotifications({
      booking: updatedBooking as any,
      customerInfo: {
        ...validatedData.customerInfo,
        phone: validatedData.customerInfo.phone ?? "",
      },
    })

    return NextResponse.json({ booking: updatedBooking })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error confirming booking:", error)
    return NextResponse.json(
      { error: "Failed to confirm booking" },
      { status: 500 }
    )
  }
}

