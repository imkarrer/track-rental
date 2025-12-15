"use client"

import { useMemo } from "react"
import { DayPicker, Matcher } from "react-day-picker"
import "react-day-picker/dist/style.css"

type DatePickerProps = {
  label: string
  value: string
  onChange: (value: string) => void
  disabledDates?: string[]
  minDate?: string
  maxDate?: string
  required?: boolean
}

// Parse YYYY-MM-DD into a local Date (no TZ shift)
function parseDateOnly(value: string | undefined | null): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function formatDateOnly(date: Date | undefined): string {
  if (!date) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function BookingDatePicker({
  label,
  value,
  onChange,
  disabledDates = [],
  minDate,
  maxDate,
  required,
}: DatePickerProps) {
  const selected = useMemo(() => parseDateOnly(value), [value])
  const disabledSet = useMemo(() => new Set(disabledDates), [disabledDates])
  const disabledMatchers: Matcher[] = useMemo(() => {
    const list: Matcher[] = []
    if (minDate) {
      const min = parseDateOnly(minDate)
      if (min) list.push({ before: min })
    }
    if (maxDate) {
      const max = parseDateOnly(maxDate)
      if (max) list.push({ after: max })
    }
    if (disabledDates.length) {
      // Function matcher to ensure exact date-string matching (no TZ shift)
      list.push((day) => disabledSet.has(formatDateOnly(day)))
    }
    return list
  }, [disabledDates, disabledSet, minDate, maxDate])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label} {required ? "*" : ""}
      </label>
      <div className="rounded-lg border bg-white p-3">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={(day) => onChange(formatDateOnly(day))}
          disabled={disabledMatchers}
          showOutsideDays
          fixedWeeks
          styles={{
            month_caption: { textAlign: "left", fontWeight: 600 },
            weekday: { fontSize: "0.8rem", color: "#6b7280" },
            day_button: { height: "2.5rem", width: "2.5rem" },
          }}
          modifiersStyles={{
            disabled: {
              color: "#ef4444",
              backgroundColor: "#fee2e2",
              textDecoration: "line-through",
              cursor: "not-allowed",
              pointerEvents: "none",
              opacity: 0.8,
            },
          }}
        />
      </div>
    </div>
  )
}

