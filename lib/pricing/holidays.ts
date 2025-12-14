/**
 * Smart Holiday pricing utilities (single global holiday multiplier).
 * Holidays override day-of-week multipliers using one shared multiplier.
 */

import { prisma } from "@/lib/db/prisma"
import { getFederalHolidaysForYear } from "@/lib/holidays/us-federal"

const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

async function getGlobalHolidayMultiplier(): Promise<number> {
  const config = await prisma.fixedCostsConfig.findFirst().catch(() => null)
  return config?.holidayMultiplier ? Number(config.holidayMultiplier) : 1.5
}

function isStandardHoliday(date: Date): { isHoliday: boolean; holidayName: string | null } {
  const dateStr = formatDateLocal(date)
  const holidays = getFederalHolidaysForYear(date.getFullYear())
  const match = holidays.find((h) => formatDateLocal(h.date) === dateStr)
  return {
    isHoliday: !!match,
    holidayName: match?.rule.name ?? null,
  }
}

/**
 * Check if a date is a holiday and return the (global) holiday multiplier
 * Returns null if not a holiday
 */
export async function getHolidayMultiplier(date: Date): Promise<number | null> {
  const { isHoliday } = isStandardHoliday(date)
  if (!isHoliday) return null
  return getGlobalHolidayMultiplier()
}

/**
 * Get day multiplier, checking holidays first
 * Holidays override day-of-week multipliers
 */
export async function getDayOrHolidayMultiplier(date: Date): Promise<number> {
  // Check for holiday first (global multiplier)
  const holidayMultiplier = await getHolidayMultiplier(date)
  if (holidayMultiplier !== null) {
    return holidayMultiplier
  }

  // Fall back to day-of-week multiplier
  const dayOfWeek = date.getDay()
  try {
    const multiplier = await prisma.dayMultiplier.findUnique({
      where: { dayOfWeek },
    })
    if (multiplier) {
      return Number(multiplier.multiplier)
    }
  } catch (error) {
    console.error("Error fetching day multiplier:", error)
  }

  // Default multipliers
  const defaultMultipliers: Record<number, number> = {
    0: 1.3, // Sunday
    1: 1.0, // Monday
    2: 1.0, // Tuesday
    3: 1.0, // Wednesday
    4: 1.0, // Thursday
    5: 1.2, // Friday
    6: 1.5, // Saturday
  }
  
  return defaultMultipliers[dayOfWeek] || 1.0
}

/**
 * Get day name and multiplier details
 */
export async function getDayMultiplierDetails(date: Date): Promise<{ multiplier: number; dayName: string; isHoliday: boolean; holidayName?: string }> {
  // Check for holiday first
  const { isHoliday: isHol, holidayName } = isStandardHoliday(date)
  if (isHol) {
    const holidayMult = await getGlobalHolidayMultiplier()
    return {
      multiplier: holidayMult,
      dayName: holidayName || "Holiday",
      isHoliday: true,
      holidayName,
    }
  }

  // Fall back to day-of-week multiplier
  const dayOfWeek = date.getDay()
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  
  try {
    const multiplierData = await prisma.dayMultiplier.findUnique({
      where: { dayOfWeek },
    })
    if (multiplierData) {
      return {
        multiplier: Number(multiplierData.multiplier),
        dayName: multiplierData.dayName,
        isHoliday: false,
      }
    }
  } catch (error) {
    console.error("Error fetching day multiplier:", error)
  }

  // Default multipliers
  const defaultMultipliers: Record<number, number> = {
    0: 1.3, // Sunday
    1: 1.0, // Monday
    2: 1.0, // Tuesday
    3: 1.0, // Wednesday
    4: 1.0, // Thursday
    5: 1.2, // Friday
    6: 1.5, // Saturday
  }
  
  return {
    multiplier: defaultMultipliers[dayOfWeek] || 1.0,
    dayName: dayNames[dayOfWeek],
    isHoliday: false,
  }
}

/**
 * Check if a date is a holiday (smart rules)
 */
export async function isHoliday(date: Date): Promise<boolean> {
  const { isHoliday } = isStandardHoliday(date)
  return isHoliday
}

