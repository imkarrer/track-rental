import { NextRequest, NextResponse } from "next/server"
import { getHolidayMultiplier, getDayOrHolidayMultiplier } from "@/lib/pricing/holidays"
import { getFederalHolidaysForYear } from "@/lib/holidays/us-federal"

const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Public API to check if a date is a holiday and get its multiplier
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")

    if (!dateStr) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      )
    }

    // Parse date string - if it's just YYYY-MM-DD, create as local date to avoid timezone issues
    let date: Date
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Date string without time - parse components and create as local date
      const [year, month, day] = dateStr.split('-').map(Number)
      date = new Date(year, month - 1, day)
    } else {
      date = new Date(dateStr)
    }
    
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    // Normalize components
    const year = date.getFullYear()
    // Format as YYYY-MM-DD for comparison
    const dateStrFormatted = formatDateLocal(date)

    // Determine holiday name from standard federal holidays
    const holidays = getFederalHolidaysForYear(year)
    const holidayMatch = holidays.find((h) => formatDateLocal(h.date) === dateStrFormatted)
    const holidayName = holidayMatch?.rule.name ?? null

    const holidayMultiplier = await getHolidayMultiplier(date)
    const dayOrHolidayMultiplier = await getDayOrHolidayMultiplier(date)

    // Debug logging
    console.log("Holiday check API:", {
      inputDateStr: dateStr,
      parsedDate: date.toString(),
      dateStrFormatted,
      holidayName,
      isHoliday: holidayMultiplier !== null,
      holidayMultiplier,
      effectiveMultiplier: dayOrHolidayMultiplier,
    })

    return NextResponse.json({
      date: dateStr,
      isHoliday: holidayMultiplier !== null,
      holidayName: holidayName,
      holidayMultiplier: holidayMultiplier,
      effectiveMultiplier: dayOrHolidayMultiplier,
    })
  } catch (error) {
    console.error("Error checking holiday:", error)
    return NextResponse.json(
      { error: "Failed to check holiday" },
      { status: 500 }
    )
  }
}

