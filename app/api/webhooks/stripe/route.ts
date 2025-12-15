import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/config"
import { prisma } from "@/lib/db/prisma"
import { sendBookingNotifications } from "@/lib/notifications/send"
import { convertReservationToBooking } from "@/lib/reservations/convert-to-booking"
import Stripe from "stripe"

// Disable body parsing, we need the raw body for webhook signature verification
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Next.js App Router automatically parses the body, but we need raw body for webhook verification
// We'll use the request body directly
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "No signature provided" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    // In CI/test mode with mocks, webhooks may not have valid signatures
    // Allow bypassing verification if explicitly in test mode
    const isTestMode = process.env.USE_STRIPE_MOCK === "true" || process.env.CI === "true"
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock_secret_for_local"
    
    if (isTestMode && webhookSecret === "whsec_mock_for_ci") {
      // In CI with mock secret, parse event without strict verification
      // This allows tests to work without a real Stripe webhook setup
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (verifyErr) {
        // If verification fails in test mode, try to parse as JSON directly
        // This is safe because we're in test mode with mocks
        console.log("⚠️ Webhook signature verification failed in test mode, parsing event directly:", verifyErr)
        const parsedBody = JSON.parse(body)
        event = parsedBody as Stripe.Event
      }
    } else {
      // Normal mode: always verify signature
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    )
  }

  try {
    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const reservationId = paymentIntent.metadata.reservationId
        const rewardId = paymentIntent.metadata.rewardId || null
        const rewardDiscount = Number(paymentIntent.metadata.rewardDiscount || "0")
        const referralCode = paymentIntent.metadata.referralCode || null
        const referralDiscount = Number(paymentIntent.metadata.referralDiscount || "0")

        if (!reservationId) {
          // Check if this is a modification payment (has bookingId but no reservationId)
          const bookingId = paymentIntent.metadata.bookingId
          const paymentType = paymentIntent.metadata.type
          
          if (bookingId || paymentType === "booking_modification_upgrade" || paymentType === "reschedule_upgrade") {
            // This is a modification payment - the modify route handles updating the booking
            // Don't create a new booking here
            console.log("Skipping booking creation for modification payment:", {
              paymentIntentId: paymentIntent.id,
              bookingId,
              paymentType,
            })
            return NextResponse.json({ received: true })
          }
          
          console.error("No reservationId in payment intent metadata")
          return NextResponse.json({ received: true })
        }

        // Check if this reservation is for a modification
        // Modification reservations are temporary and should NOT be converted to bookings
        // The modify route handles updating the existing booking
        const reservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
        })

        if (reservation) {
          // Check if reservation was created recently (within last 15 minutes)
          // AND if there's a booking for this user/track that was recently modified
          const reservationAge = Date.now() - reservation.createdAt.getTime()
          const isRecentReservation = reservationAge < 15 * 60 * 1000 // 15 minutes

          if (isRecentReservation) {
            // Check if there's a booking for this user/track with recent modification history
            const bookingWithRecentModification = await prisma.booking.findFirst({
              where: {
                userId: reservation.userId,
                trackId: reservation.trackId,
                status: { in: ["CONFIRMED", "PENDING"] },
                history: {
                  some: {
                    createdAt: {
                      gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
                    },
                    actionType: {
                      in: ["MODIFIED_DATE", "MODIFIED_CARS", "MODIFIED_BOTH"],
                    },
                  },
                },
              },
            })

            if (bookingWithRecentModification) {
              // This reservation is for a modification - don't create a duplicate booking
              // The modify route will handle updating the existing booking
              console.log("Skipping booking creation - reservation is for modification:", {
                reservationId,
                existingBookingId: bookingWithRecentModification.id,
                paymentIntentId: paymentIntent.id,
                reservationAgeMinutes: Math.round(reservationAge / 60000),
              })
              return NextResponse.json({ received: true })
            }
          }
        }

        // Convert reservation to booking (already includes referralCode and referralDiscount)
        const booking = await convertReservationToBooking(reservationId)

        console.log("Booking created from reservation:", {
          bookingId: booking.id,
          referralCode: booking.referralCode,
          referralDiscount: booking.referralDiscount,
          rewardDiscount: booking.rewardDiscount,
          subtotal: booking.subtotal,
          total: booking.total,
        })

        // Update booking with payment intent and confirm
        const confirmedBooking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentIntentId: paymentIntent.id,
            status: "CONFIRMED",
            rewardId: rewardId || undefined,
            rewardDiscount: rewardDiscount || 0,
            // Ensure referral info is preserved (should already be set by convertReservationToBooking)
            referralCode: referralCode || booking.referralCode || undefined,
            referralDiscount: referralDiscount || booking.referralDiscount || 0,
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

        await sendBookingNotifications({
          booking: confirmedBooking as any,
          customerInfo: {
            firstName: confirmedBooking.user.firstName || "",
            lastName: confirmedBooking.user.lastName || "",
            email: confirmedBooking.user.email,
            phone: confirmedBooking.user.phone || "",
            billingAddress: confirmedBooking.eventAddress,
            billingCity: confirmedBooking.eventCity,
            billingState: confirmedBooking.eventState,
            billingZip: confirmedBooking.eventZip,
          },
        })

        // Finalize reward redemption if applied
        if (rewardId) {
          await prisma.referralReward.updateMany({
            where: { id: rewardId },
            data: { status: "REDEEMED", bookingId: confirmedBooking.id },
          }).catch(() => null)
        }

        // Handle promo code redemption and rewards AFTER payment succeeds
        if (confirmedBooking.referralCode) {
          // Find the referral code
          const code = await prisma.referralCode.findUnique({
            where: { code: confirmedBooking.referralCode },
            include: { owner: true },
          })

          if (code) {
            // Check if redemption already exists
            let redemption = await prisma.referralRedemption.findUnique({
              where: { referredUserId: confirmedBooking.userId },
              include: { code: { include: { owner: true } } },
            })

            // Create redemption if it doesn't exist (for newly applied promo codes)
            if (!redemption) {
              redemption = await prisma.referralRedemption.create({
                data: {
                  codeId: code.id,
                  referredUserId: confirmedBooking.userId,
                },
                include: { code: { include: { owner: true } } },
              })

              // Increment usage count (only once, when redemption is created)
              await prisma.referralCode.update({
                where: { id: code.id },
                data: { uses: { increment: 1 } },
              })
              
              console.log("Promo code usage incremented:", {
                code: code.code,
                newUses: code.uses + 1,
                maxUses: code.maxUses,
              })
            }

            // Award referrer reward if applicable (only for user codes, not admin promo codes)
            const isOwnerAdmin = redemption.code.owner?.role === "ADMIN"
            if (!isOwnerAdmin && redemption.code.ownerUserId) {
              const programs = await prisma.referralProgramConfig.findMany()
              const programRow = programs.find((p) => p.id === "user")
              if (programRow && programRow.enabled) {
                const hasReward = await prisma.referralReward.findFirst({
                  where: {
                    codeId: redemption.codeId,
                    referredUserId: confirmedBooking.userId,
                  },
                })
                const allowOnce = programRow.referrerApplyOnce ? !hasReward : true
                if (allowOnce) {
                  const amount = programRow.referrerType === "PERCENT"
                    ? (Number(confirmedBooking.total) * Number(programRow.referrerPercentOff ?? 0)) / 100
                    : Number(programRow.referrerAmountOff ?? 0)
                  if (amount > 0) {
                    await prisma.referralReward.create({
                      data: {
                        userId: redemption.code.ownerUserId!,
                        codeId: redemption.codeId,
                        referredUserId: confirmedBooking.userId,
                        amount,
                        status: "AWARDED",
                        bookingId: confirmedBooking.id,
                      },
                    })
                  }
                }
              }
            }
          }
        }

        break
      }

      case "payment_intent.canceled": {
        const intent = event.data.object as Stripe.PaymentIntent
        const paymentIntentId = intent.id

        const booking = await prisma.booking.findFirst({
          where: { paymentIntentId },
        })

        if (booking) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: "CANCELLED",
              cancellationReason: "Payment intent canceled at Stripe",
            },
          })
        }

        break
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id

        if (!paymentIntentId) {
          console.warn("Refund event missing payment_intent")
          return NextResponse.json({ received: true })
        }

        const booking = await prisma.booking.findFirst({
          where: { paymentIntentId },
        })

        if (booking) {
          const refunded = (charge.amount_refunded || 0) / 100
          const isFullRefund = refunded >= Number(booking.total)

          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              totalRefunded: refunded,
              status: isFullRefund ? "CANCELLED" : booking.status,
              cancellationReason: isFullRefund
                ? "Fully refunded via Stripe"
                : "Partial refund via Stripe",
            },
          })
        }

        break
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute
        const paymentIntentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id

        if (!paymentIntentId) {
          console.warn("Dispute created event missing payment_intent")
          return NextResponse.json({ received: true })
        }

        const booking = await prisma.booking.findFirst({
          where: { paymentIntentId },
        })

        if (booking) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              cancellationReason: `Stripe dispute opened (reason: ${dispute.reason || "unspecified"})`,
            },
          })
        }

        break
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute
        const paymentIntentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id

        if (!paymentIntentId) {
          console.warn("Dispute closed event missing payment_intent")
          return NextResponse.json({ received: true })
        }

        const booking = await prisma.booking.findFirst({
          where: { paymentIntentId },
        })

        if (booking) {
          const outcome =
            dispute.status === "won"
              ? "Dispute won at Stripe"
              : dispute.status === "lost"
              ? "Dispute lost at Stripe"
              : `Dispute closed with status: ${dispute.status}`

          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              cancellationReason: outcome,
              status: dispute.status === "lost" ? "CANCELLED" : booking.status,
            },
          })
        }

        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const reservationId = paymentIntent.metadata.reservationId
        const rewardId = paymentIntent.metadata.rewardId || null

        if (reservationId) {
          // Delete the reservation since payment failed
          await prisma.reservation.delete({
            where: { id: reservationId },
          }).catch((err) => {
            console.error("Error deleting reservation:", err)
            // Reservation may have already been deleted or converted
          })
        }
        if (rewardId) {
          await prisma.referralReward.updateMany({
            where: { id: rewardId, status: "RESERVED" },
            data: { status: "AWARDED", bookingId: null },
          }).catch(() => null)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

