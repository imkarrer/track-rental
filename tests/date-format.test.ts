import { describe, it, expect } from "vitest"
import { toDateStringUTC, toUTCDate, formatDateUTC, formatDateWithWeekdayUTC } from "@/lib/date/format"

describe("lib/date/format", () => {
  it("converts ISO strings to stable YYYY-MM-DD without TZ shift", () => {
    const iso = "2025-12-25T05:00:00Z"
    expect(toDateStringUTC(iso)).toBe("2025-12-25")
  })

  it("builds a UTC Date from date-only strings", () => {
    const d = toUTCDate("2025-12-25")
    expect(d?.toISOString()).toBe("2025-12-25T00:00:00.000Z")
  })

  it("formats dates in UTC consistently", () => {
    const d = new Date(Date.UTC(2025, 11, 25, 15, 30)) // Dec 25 2025
    expect(formatDateUTC(d)).toBe("December 25, 2025")
    expect(formatDateWithWeekdayUTC(d)).toBe("Thursday, December 25, 2025")
  })
})

