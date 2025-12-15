import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/stripe/config"
import { getRefundCalculation } from "@/lib/refunds/calculate"
import { RefundType } from "@prisma/client"
import { z } from "zod"
import { toDateStringUTC } from "@/lib/date/format"

const cancellationSchema = z.object({
  reason: z.string().max(500).optional(),
})

function isFutureDate(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date >= today
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      eventDate: true,
      total: true,
      totalRefunded: true,
      paymentIntentId: true,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const calculation = await getRefundCalculation(booking.id)
  const eventDate = new Date(booking.eventDate)
  const canCancel =
    booking.status === "CONFIRMED" &&
    isFutureDate(eventDate) &&
    Boolean(booking.paymentIntentId)

  return NextResponse.json({
    bookingId: booking.id,
    bookingStatus: booking.status,
    eventDate: toDateStringUTC(eventDate),
    bookingTotal: Number(booking.total),
    alreadyRefunded: calculation.alreadyRefunded,
    refundableAmount: calculation.refundableAmount,
    nonRefundableAmount: calculation.nonRefundableAmount,
    remainingRefundable: calculation.remainingRefundable,
    daysBeforeService: calculation.daysBeforeService,
    policyUsed: calculation.policyUsed,
    canCancel,
    requiresManualHelp: !booking.paymentIntentId,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data = cancellationSchema.parse(body)

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { refunds: true },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Booking is already cancelled" },
        { status: 400 }
      )
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Only confirmed bookings can be cancelled online" },
        { status: 400 }
      )
    }

    const eventDate = new Date(booking.eventDate)
    if (!isFutureDate(eventDate)) {
      return NextResponse.json(
        { error: "Past bookings cannot be cancelled online" },
        { status: 400 }
      )
    }

    if (!booking.paymentIntentId) {
      return NextResponse.json(
        { error: "Payment is missing for this booking. Please contact support." },
        { status: 400 }
      )
    }

    const calculation = await getRefundCalculation(booking.id)
    const refundAmount = Math.max(0, calculation.remainingRefundable)
    const refundType: RefundType =
      refundAmount + Number(booking.totalRefunded) >= Number(booking.total)
        ? "FULL"
        : "PARTIAL"

    let stripeRefundId: string | null = null
    if (refundAmount > 0) {
      const amountInCents = Math.round(refundAmount * 100)
      try {
        const refund = await stripe.refunds.create({
          payment_intent: booking.paymentIntentId,
          amount: amountInCents,
          reason: "requested_by_customer",
          metadata: {
            bookingId: booking.id,
            refundType,
            processedBy: session.user.id,
            source: "SELF_SERVICE_CANCEL",
          },
        })
        stripeRefundId = refund.id
      } catch (stripeError) {
        console.error("Stripe refund error:", stripeError)
        return NextResponse.json(
          {
            error: "Failed to process refund with Stripe",
            details:
              stripeError instanceof Error
                ? stripeError.message
                : String(stripeError),
          },
          { status: 500 }
        )
      }
    }

    const cancellationReason =
      data.reason?.trim() || "Cancelled by customer (self-service)"
    const newTotalRefunded = Math.min(
      Number(booking.total),
      Number(booking.totalRefunded) + refundAmount
    )

    const result = await prisma.$transaction(async (tx) => {
      let refundRecord = null
      if (refundAmount > 0) {
        refundRecord = await tx.refund.create({
          data: {
            bookingId: booking.id,
            amount: refundAmount,
            refundType,
            reason: cancellationReason,
            circumstances: "Customer cancelled via self-service",
            stripeRefundId,
            processedBy: session.user.id,
            notes: calculation.policyUsed
              ? `Policy applied: ${calculation.policyUsed.nonRefundablePercent}% non-refundable (${calculation.policyUsed.daysBeforeService} days before)`
              : "Policy applied: full refund",
          },
        })
      }

      // Create history entry for cancellation
      await tx.bookingHistory.create({
        data: {
          bookingId: booking.id,
          actionType: "CANCELLED",
          performedBy: session.user.id,
          performedByRole: session.user.role || "USER",
          oldEventDate: booking.eventDate,
          oldEndDate: booking.endDate,
          oldTotal: booking.total,
          oldStatus: booking.status,
          newStatus: "CANCELLED",
          refundAmount: refundAmount > 0 ? refundAmount : null,
          refundPercent: calculation.policyUsed 
            ? 100 - Number(calculation.policyUsed.nonRefundablePercent)
            : 100,
          reason: cancellationReason,
          metadata: {
            daysBeforeService: calculation.daysBeforeService,
            policyUsed: calculation.policyUsed ? {
              daysBeforeService: calculation.policyUsed.daysBeforeService,
              nonRefundablePercent: Number(calculation.policyUsed.nonRefundablePercent),
            } : null,
            stripeRefundId,
            refundType,
            source: "SELF_SERVICE_CANCEL",
          }
        }
      })

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason,
          totalRefunded: newTotalRefunded,
        },
      })

      return { refundRecord, updatedBooking }
    })

    return NextResponse.json({
      bookingId: booking.id,
      refundAmount,
      refundId: result.refundRecord?.id ?? null,
      bookingStatus: "CANCELLED",
      totalRefunded: newTotalRefunded,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error cancelling booking:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


