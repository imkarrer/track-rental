import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

// GET - Get active refund policies for public display
export async function GET() {
  try {
    const policies = await prisma.refundPolicy.findMany({
      where: { isActive: true },
      orderBy: { daysBeforeService: "desc" },
      select: {
        id: true,
        daysBeforeService: true,
        nonRefundablePercent: true,
        description: true,
      },
    })

    return NextResponse.json({ policies })
  } catch (error) {
    console.error("Error fetching refund policies:", error)
    return NextResponse.json(
      { error: "Failed to fetch refund policies" },
      { status: 500 }
    )
  }
}

