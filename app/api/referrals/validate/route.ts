import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { getProgramConfigs, computeDiscount } from "@/lib/referrals/program-config"

const querySchema = z.object({
  code: z.string().min(4).max(32),
  total: z.string().transform(Number),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const { code, total } = querySchema.parse({
      code: searchParams.get("code"),
      total: searchParams.get("total"),
    })

    // Find the referral code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code },
      include: { owner: true },
    })

    if (!referralCode) {
      return NextResponse.json({ error: "Invalid promo code", valid: false }, { status: 404 })
    }

    // Check if code is active
    if (!referralCode.isActive) {
      return NextResponse.json({ error: "This promo code is no longer active", valid: false }, { status: 400 })
    }

    // Check if uses exceeded
    if (referralCode.uses >= referralCode.maxUses) {
      return NextResponse.json({ error: "This promo code has reached its usage limit", valid: false }, { status: 400 })
    }

    // Check if user is trying to use their own code
    if (referralCode.ownerUserId === session.user.id) {
      return NextResponse.json({ error: "You cannot use your own referral code", valid: false }, { status: 400 })
    }

    // Check if user already used a referral code
    const alreadyUsed = await prisma.referralRedemption.findUnique({
      where: { referredUserId: session.user.id },
    })

    // Get program configs to calculate discount
    const programs = await getProgramConfigs()
    const isOwnerAdmin = referralCode.owner?.role === "ADMIN"
    const program = isOwnerAdmin ? programs.admin : programs.user

    if (!program.enabled) {
      return NextResponse.json({ error: "Referral program is currently disabled", valid: false }, { status: 400 })
    }

    // Check if user can use code (only once or multiple times based on program)
    if (alreadyUsed && program.refereeApplyOnce) {
      return NextResponse.json({ 
        error: "You have already used a referral code", 
        valid: false 
      }, { status: 400 })
    }

    // Calculate discount
    const discount = computeDiscount(
      total,
      program.refereeType,
      program.refereePercentOff,
      program.refereeAmountOff
    )

    const discountedTotal = Math.max(0, total - discount)

    return NextResponse.json({
      valid: true,
      code: referralCode.code,
      name: referralCode.name || undefined,
      description: referralCode.description || undefined,
      discount: Number(discount.toFixed(2)),
      discountedTotal: Number(discountedTotal.toFixed(2)),
      originalTotal: Number(total.toFixed(2)),
      discountType: program.refereeType,
      discountPercent: program.refereeType === "PERCENT" ? program.refereePercentOff : undefined,
      discountAmount: program.refereeType === "FLAT" ? program.refereeAmountOff : undefined,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message, valid: false }, { status: 400 })
    }
    console.error("Error validating promo code:", error)
    return NextResponse.json({ error: "Failed to validate promo code", valid: false }, { status: 500 })
  }
}

