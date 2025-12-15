import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { getProgramConfigs } from "@/lib/referrals/program-config"

const bodySchema = z.object({
  code: z.string().min(4).max(32),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { code } = bodySchema.parse(body)

    const referral = await prisma.referralCode.findUnique({
      where: { code },
      include: { owner: true },
    })

    if (!referral) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user?.emailVerified) {
      return NextResponse.json({ error: "Verify your email before redeeming" }, { status: 403 })
    }

    if (referral.ownerUserId === session.user.id) {
      return NextResponse.json({ error: "You cannot redeem your own code" }, { status: 400 })
    }

    if (referral.uses >= referral.maxUses) {
      return NextResponse.json({ error: "Referral code has reached its limit" }, { status: 400 })
    }

    const alreadyUsed = await prisma.referralRedemption.findUnique({
      where: { referredUserId: session.user.id },
    })
    if (alreadyUsed) {
      return NextResponse.json({ error: "Referral already redeemed" }, { status: 400 })
    }

    const redemption = await prisma.$transaction(async (tx) => {
      // Determine program based on owner (admin vs user)
      const programs = await getProgramConfigs()
      const isOwnerAdmin = referral.owner?.role === "ADMIN" || referral.ownerUserId === null
      const program = isOwnerAdmin ? programs.admin : programs.user
      if (!program.enabled) {
        throw new Error("Referral program disabled")
      }

      const updated = await tx.referralCode.update({
        where: { id: referral.id },
        data: { uses: { increment: 1 } },
      })

      const record = await tx.referralRedemption.create({
        data: {
          codeId: referral.id,
          referredUserId: session.user.id,
        },
      })

      return { updated, record }
    })

    return NextResponse.json({
      redeemed: true,
      code,
      uses: redemption.updated.uses,
      maxUses: redemption.updated.maxUses,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Error redeeming referral code:", error)
    return NextResponse.json({ error: "Failed to redeem referral code" }, { status: 500 })
  }
}


