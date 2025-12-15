import { describe, it, expect, beforeEach, vi } from "vitest"
import { getFederalHolidaysForYear, calculateHolidayDate, US_FEDERAL_HOLIDAYS } from "@/lib/holidays/us-federal"

// Hoisted mock setup
const mockPrisma = {
  fixedCostsConfig: {
    findFirst: vi.fn(),
  },
  dayMultiplier: {
    findUnique: vi.fn(),
  },
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}))

// Import after mocks
let getHolidayMultiplier: typeof import("@/lib/pricing/holidays").getHolidayMultiplier
let getDayOrHolidayMultiplier: typeof import("@/lib/pricing/holidays").getDayOrHolidayMultiplier
let isHoliday: typeof import("@/lib/pricing/holidays").isHoliday

beforeEach(async () => {
  mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({ holidayMultiplier: 2 })
  mockPrisma.dayMultiplier.findUnique.mockResolvedValue(null)
  const mod = await import("@/lib/pricing/holidays")
  getHolidayMultiplier = mod.getHolidayMultiplier
  getDayOrHolidayMultiplier = mod.getDayOrHolidayMultiplier
  isHoliday = mod.isHoliday
})

describe("holiday utilities", () => {
  it("detects Christmas as a holiday and applies global multiplier", async () => {
    const christmas = new Date(Date.UTC(2025, 11, 25, 12)) // midday to avoid TZ shift
    expect(await isHoliday(christmas)).toBe(true)
    expect(await getHolidayMultiplier(christmas)).toBe(2)
  })

  it("uses day-of-week multiplier when not a holiday", async () => {
    const nonHoliday = new Date(Date.UTC(2025, 6, 8)) // Tuesday
    mockPrisma.dayMultiplier.findUnique.mockResolvedValue({ multiplier: 1.1 })
    const result = await getDayOrHolidayMultiplier(nonHoliday)
    expect(result).toBe(1.1)
  })

  it("falls back to default multiplier when no DB entry", async () => {
    const sunday = new Date(Date.UTC(2025, 0, 12, 12)) // Sunday midday
    mockPrisma.dayMultiplier.findUnique.mockResolvedValue(null)
    const result = await getDayOrHolidayMultiplier(sunday)
    expect(result).toBe(1.3) // default Sunday multiplier
  })
})

describe("federal holiday date calculations", () => {
  it("includes all federal holidays (11)", () => {
    const holidays = getFederalHolidaysForYear(2025)
    expect(holidays).toHaveLength(11)
  })

  it("calculates observed holidays on Friday if Saturday", () => {
    const july4Rule = US_FEDERAL_HOLIDAYS.find((h) => h.id === "independence-day")
    expect(july4Rule).toBeDefined()
    const date = calculateHolidayDate(july4Rule!, 2026)
    expect(date.toISOString().slice(0, 10)).toBe("2026-07-03")
  })

  it("calculates observed holidays on Monday if Sunday", () => {
    const newYearRule = US_FEDERAL_HOLIDAYS.find((h) => h.id === "new-years-day")
    expect(newYearRule).toBeDefined()
    const date2023 = calculateHolidayDate(newYearRule!, 2023)
    expect(date2023.toISOString().slice(0, 10)).toBe("2023-01-02")
  })

  it("returns consistent date strings", () => {
    const holidays = getFederalHolidaysForYear(2025)
    const christmas = holidays.find((h) => h.rule.id === "christmas")
    expect(christmas?.dateString).toBe("2025-12-25")
  })
})

