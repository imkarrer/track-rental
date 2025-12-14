import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rewards =
    typeof (prisma as any).referralReward?.findMany === "function"
      ? await prisma.referralReward.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
        })
      : []

  return NextResponse.json({ rewards })
}


