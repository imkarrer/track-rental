import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/stripe/config"
import { z } from "zod"

const paymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(), // Amount in dollars
})

/**
 * POST /api/bookings/reschedule-payment
 * 
 * Create a payment intent for upgrading to a more expensive day.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { bookingId, amount } = paymentSchema.parse(body)

    // Fetch the booking to verify ownership
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { track: true },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: session.user.stripeCustomerId || undefined,
      metadata: {
        bookingId: booking.id,
        userId: session.user.id,
        type: "reschedule_upgrade",
        trackName: booking.track.name,
      },
      description: `Reschedule upgrade fee for ${booking.track.name}`,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    console.error("Error creating reschedule payment intent:", error)
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

