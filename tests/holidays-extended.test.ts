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
  })
})

