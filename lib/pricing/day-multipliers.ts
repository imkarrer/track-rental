/**
 * Fetch day of week multipliers from the database
 * Falls back to defaults if not configured
 */

import { prisma } from "@/lib/db/prisma"

const DEFAULT_MULTIPLIERS: Record<number, number> = {
  0: 1.3, // Sunday
  1: 1.0, // Monday
  2: 1.0, // Tuesday
  3: 1.0, // Wednesday
  4: 1.0, // Thursday
  5: 1.2, // Friday
  6: 1.5, // Saturday
}

/**
 * Get day multiplier from database or return default
 */
export async function getDayMultiplier(dayOfWeek: number): Promise<number> {
  try {
    if (!prisma.dayMultiplier) {
      return DEFAULT_MULTIPLIERS[dayOfWeek] || 1.0
    }

    const multiplier = await prisma.dayMultiplier.findUnique({
      where: { dayOfWeek },
    })

    if (multiplier) {
      return Number(multiplier.multiplier)
    }

    return DEFAULT_MULTIPLIERS[dayOfWeek] || 1.0
  } catch (error) {
    console.error("Error fetching day multiplier:", error)
    return DEFAULT_MULTIPLIERS[dayOfWeek] || 1.0
  }
}

/**
 * Get all day multipliers
 */
export async function getAllDayMultipliers(): Promise<Record<number, number>> {
  try {
    if (!prisma.dayMultiplier) {
      return DEFAULT_MULTIPLIERS
    }

    const multipliers = await prisma.dayMultiplier.findMany()
    const result: Record<number, number> = { ...DEFAULT_MULTIPLIERS }

    multipliers.forEach((m) => {
      result[m.dayOfWeek] = Number(m.multiplier)
    })

    return result
  } catch (error) {
    console.error("Error fetching day multipliers:", error)
    return DEFAULT_MULTIPLIERS
  }
}

