import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { generateReferralCode } from "@/lib/referrals/util"
import { z } from "zod"
import { getProgramConfigs } from "@/lib/referrals/program-config"

const bodySchema = z.object({
  maxUses: z.number().int().min(1).max(1000).optional(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { maxUses } = bodySchema.parse(body)

    // Gate user-created codes by program config
    const cfgs = await getProgramConfigs()
    if (!cfgs.user.enabled) {
      return NextResponse.json({ error: "User referral program is disabled" }, { status: 403 })
    }

    // Only verified users can create
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user?.emailVerified) {
      return NextResponse.json({ error: "Verify your email before creating a referral code" }, { status: 403 })
    }

    const code = generateReferralCode()
    const created = await prisma.referralCode.create({
      data: {
        code,
        ownerUserId: session.user.id,
        maxUses: maxUses ?? 50,
      },
    })

    return NextResponse.json({
      code: created.code,
      maxUses: created.maxUses,
      uses: created.uses,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Error creating referral code:", error)
    return NextResponse.json({ error: "Failed to create referral code" }, { status: 500 })
  }
}


