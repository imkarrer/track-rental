export type DateInput = string | Date | null | undefined

/**
 * Normalize a date input to YYYY-MM-DD string (UTC-stable).
 */
export function toDateStringUTC(value: DateInput): string | null {
  if (!value) return null
  let iso: string | null = null
  if (value instanceof Date) {
    iso = value.toISOString().split("T")[0] || null
  } else if (typeof value === "string") {
    iso = value.split("T")[0] || null
  }
  if (!iso) return null
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return `${y.toString().padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

/**
 * Convert to a UTC Date using just the calendar parts (no local TZ shift).
 */
export function toUTCDate(value: DateInput): Date | null {
  const str = toDateStringUTC(value)
  if (!str) return null
  const [y, m, d] = str.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Format a date input using UTC to avoid off-by-one shifts.
 * Default: "Month Day, Year" (e.g., December 25, 2025).
 */
export function formatDateUTC(value: DateInput, opts?: Intl.DateTimeFormatOptions): string {
  const d = toUTCDate(value)
  if (!d) return "N/A"
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    ...opts,
  })
}

/**
 * Format a date with weekday (UTC-safe).
 */
export function formatDateWithWeekdayUTC(value: DateInput): string {
  const d = toUTCDate(value)
  if (!d) return "N/A"
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Convert a YYYY-MM-DD string to a UTC Date at start of day.
 */
export function toUTCStartOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

