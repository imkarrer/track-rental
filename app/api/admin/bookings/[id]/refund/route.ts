import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/stripe/config"
import { calculateNonRefundableAmount, getRefundBreakdown } from "@/lib/refunds/calculate"
import { z } from "zod"

const refundSchema = z.object({
  amount: z.number().min(0.01),
  refundType: z.enum(["FULL", "PARTIAL", "ADMIN_DISCRETION"]),
  reason: z.string().optional(),
  circumstances: z.string().optional(),
  notes: z.string().optional(),
  adminOverride: z.boolean().optional().default(false),
  selectiveRefund: z.boolean().optional().default(false), // Allow refunding beyond booking.total
})

// POST - Process a refund for a booking
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = refundSchema.parse(body)

    // Validate selective refund can only be used with admin override
    if (data.selectiveRefund && !data.adminOverride) {
      return NextResponse.json(
        { error: "Selective refund can only be used with admin override" },
        { status: 400 }
      )
    }

    // Validate required fields when admin override is used
    if (data.adminOverride) {
      if (!data.reason || data.reason.trim() === "") {
        return NextResponse.json(
          { error: "Reason is required when using admin override" },
          { status: 400 }
        )
      }
      if (!data.circumstances || data.circumstances.trim() === "") {
        return NextResponse.json(
          { error: "Circumstances are required when using admin override" },
          { status: 400 }
        )
      }
      if (!data.notes || data.notes.trim() === "") {
        return NextResponse.json(
          { error: "Admin notes are required when using admin override - please explain the justification" },
          { status: 400 }
        )
      }
    }

    // Fetch booking with payment intent
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        refunds: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    if (!booking.paymentIntentId) {
      return NextResponse.json(
        { error: "Booking has no payment intent" },
        { status: 400 }
      )
    }

    // Calculate remaining refundable amount
    const serviceDate = new Date(booking.eventDate)
    const calculation = await calculateNonRefundableAmount(
      booking.total,
      serviceDate,
      new Date()
    )

    const alreadyRefunded = Number(booking.totalRefunded)
    const bookingTotal = Number(booking.total)
    
    // Determine the maximum refundable based on admin override and selective refund
    let maxRefundable: number
    let remainingRefundable: number
    
    if (data.selectiveRefund && data.adminOverride) {
      // Selective refund with override: can refund up to original amount minus already refunded
      // This allows refunding rescheduling penalties
      const breakdown = await getRefundBreakdown(params.id)
      maxRefundable = breakdown.originalTotal
      remainingRefundable = Math.max(0, breakdown.originalTotal - alreadyRefunded)
    } else if (data.adminOverride) {
      // Admin override: can refund up to the full booking amount minus already refunded
      maxRefundable = bookingTotal
      remainingRefundable = Math.max(0, bookingTotal - alreadyRefunded)
    } else {
      // Normal policy: respect the refund policy calculations
      maxRefundable = calculation.refundableAmount
      remainingRefundable = Math.max(0, maxRefundable - alreadyRefunded)
    }

    // Validate refund amount
    if (data.amount > remainingRefundable) {
      return NextResponse.json(
        {
          error: `Refund amount exceeds remaining refundable amount of $${remainingRefundable.toFixed(2)}${data.adminOverride ? " (with admin override)" : ""}${data.selectiveRefund ? " (selective refund)" : ""}`,
        },
        { status: 400 }
      )
    }

    // Convert to cents for Stripe
    const amountInCents = Math.round(data.amount * 100)

    // Process refund with Stripe
    let stripeRefundId: string | null = null
    try {
      const refund = await stripe.refunds.create({
        payment_intent: booking.paymentIntentId,
        amount: amountInCents,
        reason: "requested_by_customer",
        metadata: {
          bookingId: booking.id,
          refundType: data.refundType,
          processedBy: session.user.id,
          adminOverride: data.adminOverride ? "true" : "false",
          selectiveRefund: data.selectiveRefund ? "true" : "false",
        },
      })
      stripeRefundId = refund.id
    } catch (stripeError) {
      console.error("Stripe refund error:", stripeError)
      return NextResponse.json(
        {
          error: "Failed to process refund with Stripe",
          details: stripeError instanceof Error ? stripeError.message : String(stripeError),
        },
        { status: 500 }
      )
    }

    // Create refund record with admin override flag in notes if applicable
    let refundNotes = data.notes || ""
    if (data.adminOverride) {
      refundNotes = `[ADMIN OVERRIDE - POLICY BYPASSED] ${refundNotes}`
    }
    if (data.selectiveRefund) {
      refundNotes = `[SELECTIVE REFUND - INCLUDES RESCHEDULING PENALTIES] ${refundNotes}`
    }

    const refundRecord = await prisma.refund.create({
      data: {
        bookingId: booking.id,
        amount: data.amount,
        refundType: data.refundType,
        reason: data.reason,
        circumstances: data.circumstances,
        stripeRefundId,
        processedBy: session.user.id,
        notes: refundNotes,
      },
    })

    // Update booking with new total refunded amount
    const newTotalRefunded = alreadyRefunded + data.amount
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        totalRefunded: newTotalRefunded,
        status: newTotalRefunded >= Number(booking.total) ? "CANCELLED" : booking.status,
        cancelledAt: newTotalRefunded >= Number(booking.total) ? new Date() : booking.cancelledAt,
      },
    })

    return NextResponse.json({
      refund: refundRecord,
      remainingRefundable: remainingRefundable - data.amount,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error processing refund:", error)
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    )
  }
}

