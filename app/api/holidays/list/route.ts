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
 * Public API to list all active holidays for a given year
 * Used by client components to display holiday pricing
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : new Date().getFullYear()

    const config = await prisma.fixedCostsConfig.findFirst().catch(() => null)
    const globalMultiplier = config?.holidayMultiplier ? Number(config.holidayMultiplier) : 1.5

    const calculated = getFederalHolidaysForYear(year)
      .map((h) => ({
        id: h.rule.id,
        name: h.rule.name,
        date: formatDateLocal(h.date),
        multiplier: globalMultiplier,
        isRecurring: true,
        year,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ holidays: calculated })
  } catch (error) {
    console.error("Error fetching holidays:", error)
    return NextResponse.json({ holidays: [] })
  }
}

