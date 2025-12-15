import { describe, it, expect, vi, beforeEach } from "vitest"
import { calculateMultiDayPricing } from "@/lib/pricing/multi-day"

// Mock holiday/day multiplier helpers used inside multi-day pricing
vi.mock("@/lib/pricing/holidays", () => ({
  getDayOrHolidayMultiplier: vi.fn(async (date: Date) => {
    const iso = date.toISOString().slice(0, 10)
    if (iso.endsWith("12-25")) return 2
    // Saturday = 1.5, Sunday = 1.3, otherwise 1.0
    const dow = date.getDay()
    if (dow === 6) return 1.5
    if (dow === 0) return 1.3
    return 1.0
  }),
  getHolidayMultiplier: vi.fn(async (date: Date) => {
    // Treat Dec 25 as holiday
    const iso = date.toISOString().slice(0, 10)
    return iso.endsWith("12-25") ? 2 : null
  }),
}))

describe("pricing/multi-day", () => {
  const baseInput = {
    trackBasePrice: 200,
    startTime: "10:00",
    endTime: "14:00",
    setupTimeMinutes: 30,
    distanceFromBase: 10,
    selectedCars: [{ carId: "a", basePricePerDay: 30, quantity: 2 }],
    taxRate: 0.1,
  }

  it("calculates multi-day pricing across a weekend span", async () => {
    const startDate = new Date(Date.UTC(2025, 10, 7)) // Friday Nov 7 2025
    const endDate = new Date(Date.UTC(2025, 10, 9)) // Sunday Nov 9 2025

    const result = await calculateMultiDayPricing({
      ...baseInput,
      startDate,
      endDate,
    })

    expect(result.totalDays).toBe(3)
    expect(result.days.map((d) => d.multiplier)).toEqual([1.0, 1.5, 1.3])
    expect(result.distanceSurcharge).toBeGreaterThanOrEqual(0)
    expect(result.total).toBeGreaterThan(0)
    expect(result.durationHours).toBe(12) // 4h per day * 3
  })

  it("applies holiday multiplier when in range", async () => {
    const startDate = new Date(Date.UTC(2025, 11, 24)) // Dec 24
    const endDate = new Date(Date.UTC(2025, 11, 25)) // Dec 25 (holiday mocked)

    const result = await calculateMultiDayPricing({
      ...baseInput,
      startDate,
      endDate,
    })

    const holidayDay = result.days.find((d) => d.isHoliday)
    expect(holidayDay).toBeDefined()
    expect(holidayDay?.multiplier).toBe(2)
  })
})

