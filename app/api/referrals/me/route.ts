import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const codes =
    typeof (prisma as any).referralCode?.findMany === "function"
      ? await prisma.referralCode.findMany({
          where: { ownerUserId: session.user.id },
          include: {
            redemptions: {
              include: {
                user: {
                  select: { email: true, firstName: true, lastName: true, createdAt: true },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : []

  return NextResponse.json({ codes })
}


