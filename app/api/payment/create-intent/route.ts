import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { stripe } from "@/lib/stripe/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { getProgramConfigs, computeDiscount } from "@/lib/referrals/program-config"

const createIntentSchema = z.object({
  reservationId: z.string().uuid(),
  rewardId: z.string().uuid().optional(),
  promoCode: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { reservationId, rewardId, promoCode } = createIntentSchema.parse(body)
    
    console.log("[Payment Intent] Request received:", {
      reservationId,
      rewardId,
      promoCode,
      hasPromoCode: !!promoCode,
    })

    // Fetch reservation to get total amount
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        user: true,
        track: true,
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    // Ensure user verified
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user?.emailVerified) {
      return NextResponse.json({ error: "Verify your email before paying" }, { status: 403 })
    }

    // Verify reservation belongs to the user
    if (reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check if reservation has expired
    if (reservation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Reservation has expired. Please start over." },
        { status: 410 }
      )
    }

    // Apply referral discount if applicable
    let referralDiscount = 0
    let referralCode: string | null = null
    let rewardDiscount = 0
    let appliedRewardId: string | null = null
    const programs = await getProgramConfigs()

    // Check for direct promo code entry (takes precedence)
    if (promoCode && promoCode.trim()) {
      const promoReferralCode = await prisma.referralCode.findUnique({
        where: { code: promoCode.trim().toUpperCase() },
        include: { owner: true },
      })

      if (!promoReferralCode) {
        return NextResponse.json({ error: "Invalid promo code" }, { status: 400 })
      }

      if (!promoReferralCode.isActive) {
        return NextResponse.json({ error: "This promo code is no longer active" }, { status: 400 })
      }

      if (promoReferralCode.uses >= promoReferralCode.maxUses) {
        return NextResponse.json({ error: "This promo code has reached its usage limit" }, { status: 400 })
      }

      if (promoReferralCode.ownerUserId === session.user.id) {
        return NextResponse.json({ error: "You cannot use your own referral code" }, { status: 400 })
      }

      // Check if already used a promo code
      const hasBooking = await prisma.booking.count({
        where: { userId: session.user.id },
      })

      const isOwnerAdmin = promoReferralCode.owner?.role === "ADMIN"
      const program = isOwnerAdmin ? programs.admin : programs.user

      if (!program.enabled) {
        return NextResponse.json({ error: "Referral program is currently disabled" }, { status: 400 })
      }

      const allowOnce = program.refereeApplyOnce ? hasBooking === 0 : true
      if (!allowOnce) {
        return NextResponse.json({ error: "You have already used a promo code" }, { status: 400 })
      }

      referralCode = promoReferralCode.code
      referralDiscount = computeDiscount(
        Number(reservation.total),
        program.refereeType,
        program.refereePercentOff,
        program.refereeAmountOff
      )

      // Store promo code info in reservation
      // NOTE: We DON'T create redemption or increment usage here
      // That happens in the webhook after payment succeeds
      console.log("[Payment Intent] Updating reservation with promo code:", {
        reservationId: reservation.id,
        referralCode,
        referralDiscount,
      })
      
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          referralCode,
          referralDiscount,
        },
      })
      
      console.log("[Payment Intent] Reservation updated successfully")
    } else {
      // Check for existing redemption (previously redeemed code)
      const redemption = await prisma.referralRedemption.findUnique({
        where: { referredUserId: session.user.id },
        include: { code: { include: { owner: true } } },
      })

      // Apply only on first booking if configured for the program
      const hasBooking = await prisma.booking.count({
        where: { userId: session.user.id },
      })

      if (redemption) {
        const isOwnerAdmin = redemption.code.owner?.role === "ADMIN" || redemption.code.ownerUserId === null
        const program = isOwnerAdmin ? programs.admin : programs.user
        if (program.enabled) {
          const allowOnce = program.refereeApplyOnce ? hasBooking === 0 : true
          if (allowOnce) {
            referralCode = redemption.code.code
            referralDiscount = computeDiscount(
              Number(reservation.total),
              program.refereeType,
              program.refereePercentOff,
              program.refereeAmountOff
            )
            if (referralDiscount > 0) {
              await prisma.reservation.update({
                where: { id: reservation.id },
                data: {
                  referralCode,
                  referralDiscount,
                },
              })
            }
          }
        }
      }
    }

    // Apply reward (user-owned credits)
    if (rewardId) {
      const reward = await prisma.referralReward.findUnique({
        where: { id: rewardId },
      })
      if (!reward || reward.userId !== session.user.id || reward.status !== "AWARDED") {
        return NextResponse.json({ error: "Invalid reward" }, { status: 400 })
      }
      rewardDiscount = Math.min(Number(reward.amount), Number(reservation.total) - referralDiscount)
      appliedRewardId = reward.id
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          rewardId: appliedRewardId,
          rewardDiscount,
        },
      })
    }

    // Convert total to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.max(
      0,
      Math.round((Number(reservation.total) - referralDiscount - rewardDiscount) * 100)
    )

    if (amountInCents <= 0) {
      return NextResponse.json(
        { error: "Invalid reservation amount. Total must be greater than 0." },
        { status: 400 }
      )
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        reservationId: reservation.id,
        userId: reservation.userId,
        trackId: reservation.trackId,
        referralCode: referralCode ?? "",
        referralDiscount: referralDiscount.toFixed(2),
        rewardId: appliedRewardId ?? "",
        rewardDiscount: rewardDiscount.toFixed(2),
      },
      description: `RC Track Rental - ${reservation.track.name}`,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      reservationId: reservation.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating payment intent:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create payment intent"
    const errorDetails = error instanceof Error ? error.stack : String(error)
    console.error("Error details:", errorDetails)
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? errorDetails : undefined
      },
      { status: 500 }
    )
  }
}

