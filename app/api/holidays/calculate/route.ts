import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getFederalHolidaysForYear } from "@/lib/holidays/us-federal"

const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// GET - Calculate holidays for a specific year or date range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const date = searchParams.get("date")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const config = await prisma.fixedCostsConfig.findFirst().catch(() => null)
    const globalMultiplier = config?.holidayMultiplier ? Number(config.holidayMultiplier) : 1.5

    // If checking a specific date
    if (date) {
      const checkDate = new Date(date + 'T00:00:00')
      const checkYear = checkDate.getFullYear()
      
      const yearHolidays = getFederalHolidaysForYear(checkYear).map((h) => ({
        rule: h.rule,
        date: h.date,
        dateString: formatDateLocal(h.date),
      }))

      // Check if the date matches any holiday
      const match = yearHolidays.find(h => h.dateString === date)

      if (match) {
        return NextResponse.json({
          isHoliday: true,
          holiday: {
            id: match.rule.id,
            name: match.rule.name,
            description: match.rule.description,
            date: match.dateString,
            priceMultiplier: globalMultiplier,
          },
        })
      }

      return NextResponse.json({
        isHoliday: false,
        date,
      })
    }

    // If requesting a specific year
    if (year) {
      const yearNum = parseInt(year)
      if (isNaN(yearNum)) {
        return NextResponse.json(
          { error: "Invalid year parameter" },
          { status: 400 }
        )
      }

      const holidays = getFederalHolidaysForYear(yearNum)
        .map(({ rule, date }) => {
          const dateString = formatDateLocal(date)
          return {
            id: rule.id,
            name: rule.name,
            description: rule.description,
            date: dateString,
            dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
            priceMultiplier: globalMultiplier,
            isFederal: true,
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date))

      return NextResponse.json({
        year: yearNum,
        count: holidays.length,
        holidays,
      })
    }

    // If requesting a date range
    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T00:00:00')
      const startYear = start.getFullYear()
      const endYear = end.getFullYear()

      const allHolidays: Array<{
        id: string
        name: string
        description: string
        date: string
        dayOfWeek: string
        priceMultiplier: number
        isFederal: boolean
      }> = []

      // Calculate for all years in the range
      for (let y = startYear; y <= endYear; y++) {
        const yearHolidays = getFederalHolidaysForYear(y)
          .map(({ rule, date }) => {
            if (date >= start && date <= end) {
              const dateString = formatDateLocal(date)
              return {
                id: rule.id,
                name: rule.name,
                description: rule.description,
                date: dateString,
                dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
                priceMultiplier: globalMultiplier,
                isFederal: true,
              }
            }
            return null
          })
          .filter((h): h is NonNullable<typeof h> => h !== null)

        allHolidays.push(...yearHolidays)
      }

      allHolidays.sort((a, b) => a.date.localeCompare(b.date))

      return NextResponse.json({
        startDate,
        endDate,
        count: allHolidays.length,
        holidays: allHolidays,
      })
    }

    // Default: return current year
    const currentYear = new Date().getFullYear()
    const holidays = getFederalHolidaysForYear(currentYear)
      .map(({ rule, date }) => {
        const dateString = formatDateLocal(date)
        return {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          date: dateString,
          dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
          priceMultiplier: globalMultiplier,
          isFederal: true,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      year: currentYear,
      count: holidays.length,
      holidays,
    })
  } catch (error) {
    console.error("Error calculating holidays:", error)
    return NextResponse.json(
      { error: "Failed to calculate holidays" },
      { status: 500 }
    )
  }
}

