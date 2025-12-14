import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getFederalHolidaysForYear } from "@/lib/holidays/us-federal"

const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Get the holiday multiplier for a specific date
 * If no date provided, returns the global default multiplier
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const config = await prisma.fixedCostsConfig.findFirst().catch(() => null)
    const globalMultiplier = config?.holidayMultiplier ? Number(config.holidayMultiplier) : 1.5

    // If no date provided, return global default
    if (!dateParam) {
      return NextResponse.json({ multiplier: globalMultiplier })
    }

    // Validate date
    const date = dateParam.match(/^\d{4}-\d{2}-\d{2}$/)
      ? new Date(dateParam + "T00:00:00")
      : new Date(dateParam)

    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    const dateStr = formatDateLocal(date)
    const holidays = getFederalHolidaysForYear(date.getFullYear())
    const match = holidays.find((h) => formatDateLocal(h.date) === dateStr)

    if (match) {
      return NextResponse.json({
        multiplier: globalMultiplier,
        isHoliday: true,
        holiday: {
          id: match.rule.id,
          name: match.rule.name,
          date: dateStr,
        },
      })
    }

    // Not a holiday, return neutral 1.0
    return NextResponse.json({
      multiplier: 1.0,
      isHoliday: false,
    })
  } catch (error) {
    console.error("Error fetching holiday multiplier:", error)
    // Fallback to global default
    const config = await prisma.fixedCostsConfig.findFirst().catch(() => null)
    const holidayMultiplier = config?.holidayMultiplier
      ? Number(config.holidayMultiplier)
      : 1.5
    return NextResponse.json({ multiplier: holidayMultiplier })
  }
}

