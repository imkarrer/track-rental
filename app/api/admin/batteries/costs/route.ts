import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { calculateBatteryCosts } from "@/lib/pricing/battery-costs"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const durationHours = parseFloat(searchParams.get("durationHours") || "8")
    const category = (searchParams.get("category") || "ROAD") as "ROAD" | "OFFROAD"
    const laborRatePerHour = parseFloat(searchParams.get("laborRatePerHour") || "20")

    const costs = await calculateBatteryCosts(durationHours, category, laborRatePerHour)

    return NextResponse.json({ costs })
  } catch (error) {
    console.error("Error calculating battery costs:", error)
    return NextResponse.json(
      { error: "Failed to calculate battery costs" },
      { status: 500 }
    )
  }
}

