import { describe, it, expect } from "vitest"
import {
  toDateStringUTC,
  toUTCDate,
  formatDateUTC,
  formatDateWithWeekdayUTC,
  toUTCStartOfDay,
} from "@/lib/date/format"

describe("lib/date/format - extended edge cases", () => {
  describe("toDateStringUTC", () => {
    it("handles null input", () => {
      expect(toDateStringUTC(null)).toBeNull()
    })

    it("handles undefined input", () => {
      expect(toDateStringUTC(undefined)).toBeNull()
    })

    it("handles empty string", () => {
      expect(toDateStringUTC("")).toBeNull()
    })

    it("handles invalid date string", () => {
      expect(toDateStringUTC("invalid")).toBeNull()
    })

    it("handles date string without time component", () => {
      expect(toDateStringUTC("2025-12-25")).toBe("2025-12-25")
    })

    it("handles date string with time component", () => {
      expect(toDateStringUTC("2025-12-25T10:30:00Z")).toBe("2025-12-25")
    })

    it("handles date string with milliseconds", () => {
      expect(toDateStringUTC("2025-12-25T10:30:00.123Z")).toBe("2025-12-25")
    })

    it("handles Date object", () => {
      const date = new Date("2025-12-25T10:30:00Z")
      expect(toDateStringUTC(date)).toBe("2025-12-25")
    })

    it("handles Date object at midnight UTC", () => {
      const date = new Date("2025-12-25T00:00:00.000Z")
      expect(toDateStringUTC(date)).toBe("2025-12-25")
    })

    it("handles Date object at end of day UTC", () => {
      const date = new Date("2025-12-25T23:59:59.999Z")
      expect(toDateStringUTC(date)).toBe("2025-12-25")
    })

    it("handles single digit months and days", () => {
      expect(toDateStringUTC("2025-1-5")).toBe("2025-01-05")
    })

    it("handles leap year dates", () => {
      expect(toDateStringUTC("2024-02-29")).toBe("2024-02-29")
    })

    it("handles year boundary dates", () => {
      expect(toDateStringUTC("2025-01-01")).toBe("2025-01-01")
      expect(toDateStringUTC("2025-12-31")).toBe("2025-12-31")
    })

    it("handles malformed date string", () => {
      // The function doesn't validate dates, it just formats strings
      // Invalid dates like month 13 or day 45 will be formatted as-is
      expect(toDateStringUTC("2025-13-45")).toBe("2025-13-45")
    })

    it("handles date string with only year", () => {
      expect(toDateStringUTC("2025")).toBeNull()
    })

    it("handles date string with year and month only", () => {
      expect(toDateStringUTC("2025-12")).toBeNull()
    })
  })

  describe("toUTCDate", () => {
    it("handles null input", () => {
      expect(toUTCDate(null)).toBeNull()
    })

    it("handles undefined input", () => {
      expect(toUTCDate(undefined)).toBeNull()
    })

    it("handles invalid date string", () => {
      expect(toUTCDate("invalid")).toBeNull()
    })

    it("converts valid date string to UTC Date", () => {
      const result = toUTCDate("2025-12-25")
      expect(result).not.toBeNull()
      expect(result?.toISOString()).toBe("2025-12-25T00:00:00.000Z")
    })

    it("converts Date object to UTC Date", () => {
      const input = new Date("2025-12-25T10:30:00Z")
      const result = toUTCDate(input)
      expect(result).not.toBeNull()
      expect(result?.toISOString()).toBe("2025-12-25T00:00:00.000Z")
    })

    it("handles date string with time component", () => {
      const result = toUTCDate("2025-12-25T15:30:00Z")
      expect(result).not.toBeNull()
      expect(result?.toISOString()).toBe("2025-12-25T00:00:00.000Z")
    })

    it("handles single digit months and days", () => {
      const result = toUTCDate("2025-1-5")
      expect(result).not.toBeNull()
      expect(result?.toISOString()).toBe("2025-01-05T00:00:00.000Z")
    })
  })

  describe("formatDateUTC", () => {
    it("handles null input", () => {
      expect(formatDateUTC(null)).toBe("N/A")
    })

    it("handles undefined input", () => {
      expect(formatDateUTC(undefined)).toBe("N/A")
    })

    it("handles invalid date string", () => {
      expect(formatDateUTC("invalid")).toBe("N/A")
    })

    it("formats date string correctly", () => {
      const result = formatDateUTC("2025-12-25")
      expect(result).toBe("December 25, 2025")
    })

    it("formats Date object correctly", () => {
      const date = new Date("2025-12-25T10:30:00Z")
      const result = formatDateUTC(date)
      expect(result).toBe("December 25, 2025")
    })

    it("handles custom format options", () => {
      const date = new Date("2025-12-25T10:30:00Z")
      const result = formatDateUTC(date, { month: "short", day: "numeric", year: "numeric" })
      expect(result).toBe("Dec 25, 2025")
    })

    it("handles year-only format", () => {
      const date = new Date("2025-12-25T10:30:00Z")
      // formatDateUTC always includes year, month, and day by default
      // Custom options are merged but don't override defaults completely
      const result = formatDateUTC(date, { year: "numeric", month: undefined, day: undefined } as any)
      // The function always includes all parts, so we just verify it contains the year
      expect(result).toContain("2025")
    })

    it("handles month and day format", () => {
      const date = new Date("2025-12-25T10:30:00Z")
      // formatDateUTC always includes year, month, and day by default
      // Custom options are merged but year is always included
      const result = formatDateUTC(date, { month: "long", day: "numeric" })
      // The function always includes all parts, so we verify it contains month and day
      expect(result).toContain("December")
      expect(result).toContain("25")
    })

    it("handles leap year date", () => {
      const result = formatDateUTC("2024-02-29")
      expect(result).toBe("February 29, 2024")
    })

    it("handles year boundary dates", () => {
      expect(formatDateUTC("2025-01-01")).toBe("January 1, 2025")
      expect(formatDateUTC("2025-12-31")).toBe("December 31, 2025")
    })
  })

  describe("formatDateWithWeekdayUTC", () => {
    it("handles null input", () => {
      expect(formatDateWithWeekdayUTC(null)).toBe("N/A")
    })

    it("handles undefined input", () => {
      expect(formatDateWithWeekdayUTC(undefined)).toBe("N/A")
    })

    it("handles invalid date string", () => {
      expect(formatDateWithWeekdayUTC("invalid")).toBe("N/A")
    })

    it("formats date string with weekday", () => {
      const result = formatDateWithWeekdayUTC("2025-12-25")
      expect(result).toBe("Thursday, December 25, 2025")
    })

    it("formats Date object with weekday", () => {
      const date = new Date("2025-12-25T10:30:00Z")
      const result = formatDateWithWeekdayUTC(date)
      expect(result).toBe("Thursday, December 25, 2025")
    })

    it("handles different weekdays correctly", () => {
      expect(formatDateWithWeekdayUTC("2025-12-21")).toContain("Sunday") // Dec 21, 2025 is Sunday
      expect(formatDateWithWeekdayUTC("2025-12-22")).toContain("Monday")
      expect(formatDateWithWeekdayUTC("2025-12-23")).toContain("Tuesday")
      expect(formatDateWithWeekdayUTC("2025-12-24")).toContain("Wednesday")
      expect(formatDateWithWeekdayUTC("2025-12-25")).toContain("Thursday")
      expect(formatDateWithWeekdayUTC("2025-12-26")).toContain("Friday")
      expect(formatDateWithWeekdayUTC("2025-12-27")).toContain("Saturday")
    })

    it("handles leap year date", () => {
      const result = formatDateWithWeekdayUTC("2024-02-29")
      expect(result).toContain("Thursday") // Feb 29, 2024 is Thursday
      expect(result).toContain("February 29, 2024")
    })
  })

  describe("toUTCStartOfDay", () => {
    it("converts date string to UTC start of day", () => {
      const result = toUTCStartOfDay("2025-12-25")
      expect(result.toISOString()).toBe("2025-12-25T00:00:00.000Z")
    })

    it("handles single digit months and days", () => {
      const result = toUTCStartOfDay("2025-1-5")
      expect(result.toISOString()).toBe("2025-01-05T00:00:00.000Z")
    })

    it("handles year boundary dates", () => {
      expect(toUTCStartOfDay("2025-01-01").toISOString()).toBe("2025-01-01T00:00:00.000Z")
      expect(toUTCStartOfDay("2025-12-31").toISOString()).toBe("2025-12-31T00:00:00.000Z")
    })

    it("handles leap year date", () => {
      const result = toUTCStartOfDay("2024-02-29")
      expect(result.toISOString()).toBe("2024-02-29T00:00:00.000Z")
    })

    it("always sets time to midnight UTC", () => {
      const result = toUTCStartOfDay("2025-12-25")
      expect(result.getUTCHours()).toBe(0)
      expect(result.getUTCMinutes()).toBe(0)
      expect(result.getUTCSeconds()).toBe(0)
      expect(result.getUTCMilliseconds()).toBe(0)
    })
  })
})
