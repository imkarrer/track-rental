import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || "Unknown"
}

const DEFAULT_MULTIPLIERS = [
  { dayOfWeek: 0, multiplier: 1.3, dayName: "Sunday" },
  { dayOfWeek: 1, multiplier: 1.0, dayName: "Monday" },
  { dayOfWeek: 2, multiplier: 1.0, dayName: "Tuesday" },
  { dayOfWeek: 3, multiplier: 1.0, dayName: "Wednesday" },
  { dayOfWeek: 4, multiplier: 1.0, dayName: "Thursday" },
  { dayOfWeek: 5, multiplier: 1.2, dayName: "Friday" },
  { dayOfWeek: 6, multiplier: 1.5, dayName: "Saturday" },
]

/**
 * Public API route to fetch all day multipliers
 * Used by client components to display pricing
 */
export async function GET(request: NextRequest) {
  try {
    // Try to fetch from database
    try {
      const multipliers = await prisma.dayMultiplier.findMany({
        orderBy: { dayOfWeek: "asc" },
      })

      if (multipliers.length > 0) {
        return NextResponse.json({
          multipliers: multipliers.map((m) => ({
            dayOfWeek: m.dayOfWeek,
            multiplier: Number(m.multiplier),
            dayName: m.dayName || getDayName(m.dayOfWeek), // Use dayName field, fallback to calculated name
          })),
        })
      }
    } catch (error) {
      // If table doesn't exist or other DB error, fall back to defaults
      console.error("Error fetching day multipliers from DB:", error)
    }

    // Fall back to defaults
    return NextResponse.json({ multipliers: DEFAULT_MULTIPLIERS })
  } catch (error) {
    console.error("Error in day multipliers API:", error)
    // Return defaults on error
    return NextResponse.json({ multipliers: DEFAULT_MULTIPLIERS })
  }
}
