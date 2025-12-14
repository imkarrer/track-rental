import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { getRefundBreakdown } from "@/lib/refunds/calculate"

// GET - Get refund breakdown for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const breakdown = await getRefundBreakdown(params.id)

    return NextResponse.json(breakdown)
  } catch (error) {
    console.error("Error getting refund breakdown:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get refund breakdown" },
      { status: 500 }
    )
  }
}
