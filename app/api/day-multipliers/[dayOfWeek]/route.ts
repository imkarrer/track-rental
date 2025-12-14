import { NextRequest, NextResponse } from "next/server"
import { getDayOrHolidayMultiplier } from "@/lib/pricing/holidays"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dayOfWeek: string }> }
) {
  try {
    const { dayOfWeek } = await params
    const dayOfWeekNum = parseInt(dayOfWeek, 10)

    if (isNaN(dayOfWeekNum) || dayOfWeekNum < 0 || dayOfWeekNum > 6) {
      return NextResponse.json(
        { error: "Invalid day of week. Must be 0-6." },
        { status: 400 }
      )
    }

    // Get date from query params or use today
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")
    const date = dateStr ? new Date(dateStr) : new Date()

    // Use holiday-aware multiplier (checks holidays first, then day-of-week)
    const multiplier = await getDayOrHolidayMultiplier(date)

    return NextResponse.json({
      dayOfWeek: dayOfWeekNum,
      multiplier: multiplier,
      isHoliday: dateStr !== null, // If date provided, check if it's a holiday
    })
  } catch (error) {
    console.error("Error in day multiplier API:", error)
    return NextResponse.json(
      { error: "Failed to fetch day multiplier" },
      { status: 500 }
    )
  }
}

