import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { calculateChargerCosts } from "@/lib/pricing/charger-costs"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const monthlyRentalsTarget = parseInt(searchParams.get("monthlyRentalsTarget") || "4")

    const costs = await calculateChargerCosts(monthlyRentalsTarget)

    return NextResponse.json({ costs })
  } catch (error) {
    console.error("Error calculating charger costs:", error)
    return NextResponse.json(
      { error: "Failed to calculate charger costs" },
      { status: 500 }
    )
  }
}

