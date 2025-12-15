import { describe, it, expect } from "vitest"
import {
  calculateHolidayDate,
  getFederalHolidaysForYear,
  isHoliday,
  getHolidayMultiplier,
  getHolidaysInRange,
  US_FEDERAL_HOLIDAYS,
  HolidayRule,
} from "@/lib/holidays/us-federal"

describe("holidays/us-federal extended coverage", () => {
  describe("calculateHolidayDate error cases", () => {
    it("throws for fixed holiday missing month", () => {
      const rule: HolidayRule = {
        id: "test",
        name: "Test",
        description: "Test",
        type: "fixed",
        day: 1,
        priceMultiplier: 1.0,
        isActive: true,
      }
      expect(() => calculateHolidayDate(rule, 2025)).toThrow("missing month or day")
    })

    it("throws for fixed holiday missing day", () => {
      const rule: HolidayRule = {
        id: "test",
        name: "Test",
        description: "Test",
        type: "fixed",
        month: 1,
        priceMultiplier: 1.0,
        isActive: true,
      }
      expect(() => calculateHolidayDate(rule, 2025)).toThrow("missing month or day")
    })

    it("throws for nth-weekday holiday missing month", () => {
      const rule: HolidayRule = {
        id: "test",
        name: "Test",
        description: "Test",
        type: "nth-weekday",
        weekday: 1,
        week: 1,
        priceMultiplier: 1.0,
        isActive: true,
      }
      expect(() => calculateHolidayDate(rule, 2025)).toThrow("missing required fields")
    })

    it("throws for nth-weekday holiday missing weekday", () => {
      const rule: HolidayRule = {
        id: "test",
        name: "Test",
        description: "Test",
        type: "nth-weekday",
        month: 1,
        week: 1,
        priceMultiplier: 1.0,
        isActive: true,
      }
      expect(() => calculateHolidayDate(rule, 2025)).toThrow("missing required fields")
    })

    it("throws for nth-weekday holiday missing week", () => {
      const rule: HolidayRule = {
        id: "test",
        name: "Test",
        description: "Test",
        type: "nth-weekday",
        month: 1,
        weekday: 1,
        priceMultiplier: 1.0,
        isActive: true,
      }
      expect(() => calculateHolidayDate(rule, 2025)).toThrow("missing required fields")
    })

    it("throws for relative holiday type", () => {
      const rule: HolidayRule = {
        id: "test",
        name: "Test",
        description: "Test",
        type: "relative",
        priceMultiplier: 1.0,
        isActive: true,
      }
      expect(() => calculateHolidayDate(rule, 2025)).toThrow("Relative holidays not yet implemented")
    })

    it("throws for unknown holiday type", () => {
      const rule = {
        id: "test",
        name: "Test",
        description: "Test",
        type: "unknown",
        priceMultiplier: 1.0,
        isActive: true,
      } as HolidayRule
      expect(() => calculateHolidayDate(rule, 2025)).toThrow("Unknown holiday type")
    })
  })

  describe("observance rules", () => {
    it("moves Sunday holiday to Monday when observedOnMonday is true", () => {
      // New Year's Day 2023 was on Sunday, should be observed Monday Jan 2
      const result = calculateHolidayDate(US_FEDERAL_HOLIDAYS[0], 2023)
      expect(result.getFullYear()).toBe(2023)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(2) // Monday
    })

    it("moves Saturday holiday to Friday when observedOnFriday is true", () => {
      // July 4th, 2026 is a Saturday, should be observed Friday July 3
      const independenceDay = US_FEDERAL_HOLIDAYS.find(h => h.id === "independence-day")!
      const result = calculateHolidayDate(independenceDay, 2026)
      expect(result.getMonth()).toBe(6) // July
      expect(result.getDate()).toBe(3) // Friday
    })

    it("does not move holiday when it falls on weekday", () => {
      // July 4th, 2025 is a Friday - no adjustment needed
      const independenceDay = US_FEDERAL_HOLIDAYS.find(h => h.id === "independence-day")!
      const result = calculateHolidayDate(independenceDay, 2025)
      expect(result.getMonth()).toBe(6)
      expect(result.getDate()).toBe(4)
    })
  })

  describe("last weekday of month", () => {
    it("calculates Memorial Day correctly (last Monday of May)", () => {
      const memorialDay = US_FEDERAL_HOLIDAYS.find(h => h.id === "memorial-day")!
      
      // 2025: May 26
      const result2025 = calculateHolidayDate(memorialDay, 2025)
      expect(result2025.getMonth()).toBe(4) // May
      expect(result2025.getDate()).toBe(26)
      
      // 2024: May 27
      const result2024 = calculateHolidayDate(memorialDay, 2024)
      expect(result2024.getMonth()).toBe(4)
      expect(result2024.getDate()).toBe(27)
    })
  })

  describe("getFederalHolidaysForYear", () => {
    it("returns all active holidays sorted by date", () => {
      const holidays = getFederalHolidaysForYear(2025)
      expect(holidays.length).toBe(11) // All 11 federal holidays
      
      // Verify sorted order
      for (let i = 1; i < holidays.length; i++) {
        expect(holidays[i].date.getTime()).toBeGreaterThanOrEqual(holidays[i - 1].date.getTime())
      }
    })

    it("includes dateString in YYYY-MM-DD format", () => {
      const holidays = getFederalHolidaysForYear(2025)
      holidays.forEach(h => {
        expect(h.dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })
  })

  describe("isHoliday", () => {
    it("returns isHoliday true for a federal holiday", () => {
      const result = isHoliday("2025-12-25")
      expect(result.isHoliday).toBe(true)
      expect(result.holiday?.id).toBe("christmas")
      expect(result.observedDate).toBe("2025-12-25")
    })

    it("returns isHoliday false for a non-holiday", () => {
      const result = isHoliday("2025-06-15")
      expect(result.isHoliday).toBe(false)
      expect(result.holiday).toBeUndefined()
    })
  })

  describe("getHolidayMultiplier", () => {
    it("returns holiday multiplier for a holiday", () => {
      const multiplier = getHolidayMultiplier("2025-12-25")
      expect(multiplier).toBe(1.5) // Christmas multiplier
    })

    it("returns 1.0 for non-holiday", () => {
      const multiplier = getHolidayMultiplier("2025-06-15")
      expect(multiplier).toBe(1.0)
    })
  })

  describe("getHolidaysInRange", () => {
    it("returns holidays within the date range", () => {
      const holidays = getHolidaysInRange("2025-01-01", "2025-03-01")
      expect(holidays.length).toBeGreaterThan(0)
      
      holidays.forEach(h => {
        expect(h.date >= new Date("2025-01-01T00:00:00")).toBe(true)
        expect(h.date <= new Date("2025-03-01T00:00:00")).toBe(true)
      })
    })

    it("handles multi-year ranges", () => {
      const holidays = getHolidaysInRange("2024-12-01", "2025-02-01")
      
      // Should include Christmas 2024 and New Year's 2025
      const christmas = holidays.find(h => h.rule.id === "christmas")
      const newYears = holidays.find(h => h.rule.id === "new-years-day")
      
      expect(christmas).toBeDefined()
      expect(newYears).toBeDefined()
    })

    it("returns empty array for range with no holidays", () => {
      const holidays = getHolidaysInRange("2025-03-15", "2025-03-20")
      expect(holidays).toEqual([])
    })

    it("handles single day range", () => {
      const holidays = getHolidaysInRange("2025-12-25", "2025-12-25")
      expect(holidays.length).toBe(1)
      expect(holidays[0].rule.id).toBe("christmas")
    })

    it("handles range spanning multiple years", () => {
      const holidays = getHolidaysInRange("2024-12-01", "2026-01-31")
      // Should include holidays from Dec 2024, all of 2025, and Jan 2026
      // That's about 1 holiday from 2024 (Christmas), 11 from 2025, and 1 from 2026 (New Year's)
      expect(holidays.length).toBeGreaterThanOrEqual(13) // At least 13 holidays across the range
    })

    it("handles boundary dates correctly", () => {
      // Test start date exactly on a holiday
      const holidaysStart = getHolidaysInRange("2025-12-25", "2025-12-31")
      expect(holidaysStart.some(h => h.dateString === "2025-12-25")).toBe(true)

      // Test end date exactly on a holiday
      const holidaysEnd = getHolidaysInRange("2025-01-01", "2025-01-01")
      expect(holidaysEnd.some(h => h.dateString === "2025-01-01")).toBe(true)
    })
  })

  describe("edge cases for nth weekday calculation", () => {
    it("handles first weekday correctly", () => {
      const laborDay = US_FEDERAL_HOLIDAYS.find(h => h.id === "labor-day")!
      const result = calculateHolidayDate(laborDay, 2025)
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getMonth()).toBe(8) // September
      expect(result.getDate()).toBe(1) // First Monday
    })

    it("handles second weekday correctly", () => {
      const columbusDay = US_FEDERAL_HOLIDAYS.find(h => h.id === "columbus-day")!
      const result = calculateHolidayDate(columbusDay, 2025)
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getMonth()).toBe(9) // October
      // Should be second Monday (between 8-14)
      expect(result.getDate()).toBeGreaterThanOrEqual(8)
      expect(result.getDate()).toBeLessThanOrEqual(14)
    })

    it("handles fourth weekday correctly", () => {
      const thanksgiving = US_FEDERAL_HOLIDAYS.find(h => h.id === "thanksgiving")!
      const result = calculateHolidayDate(thanksgiving, 2025)
      expect(result.getDay()).toBe(4) // Thursday
      expect(result.getMonth()).toBe(10) // November
      // Should be fourth Thursday (between 22-28)
      expect(result.getDate()).toBeGreaterThanOrEqual(22)
      expect(result.getDate()).toBeLessThanOrEqual(28)
    })
  })

  describe("isHoliday edge cases", () => {
    it("handles observed dates correctly", () => {
      // New Year's Day 2023 was Sunday, observed Monday Jan 2
      const result = isHoliday("2023-01-02")
      expect(result.isHoliday).toBe(true)
      expect(result.holiday?.id).toBe("new-years-day")
    })

    it("handles invalid date strings gracefully", () => {
      // Invalid date strings create invalid Date objects
      // getFullYear() on invalid date returns NaN, which causes issues
      // The function may throw, so we test that it handles it appropriately
      // For truly invalid dates, we expect it to either return false or handle gracefully
      const result = isHoliday("invalid-date")
      // If it doesn't throw, it should return false for invalid dates
      expect(result.isHoliday).toBe(false)
    })
  })
})

