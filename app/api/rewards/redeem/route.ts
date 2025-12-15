import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const schema = z.object({
  rewardId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { rewardId } = schema.parse(body)
    const reward = await prisma.referralReward.findUnique({ where: { id: rewardId } })
    if (!reward || reward.userId !== session.user.id || reward.status !== "AWARDED") {
      return NextResponse.json({ error: "Invalid reward" }, { status: 400 })
    }
    // Mark as reserved to prevent double use; will be finalized on payment success
    await prisma.referralReward.update({
      where: { id: rewardId },
      data: { status: "RESERVED" },
    })
    return NextResponse.json({ reserved: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Failed to reserve reward:", error)
    return NextResponse.json({ error: "Failed to reserve reward" }, { status: 500 })
  }
}


