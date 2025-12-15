"use client"

import { useMemo } from "react"
import { DayPicker, DateRange, Matcher } from "react-day-picker"
import "react-day-picker/dist/style.css"

type DateRangePickerProps = {
  label: string
  startValue: string
  endValue: string
  onChange: (start: string, end: string) => void
  disabledDates?: string[]
  minDate?: string
  maxDate?: string
  required?: boolean
  currentBookingStartDate?: string // Highlight existing booking date without selecting
  currentBookingEndDate?: string   // For multi-day bookings
  defaultMonth?: Date // Month to display when calendar first renders
  'data-testid'?: string
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

export function BookingDateRangePicker({
  label,
  startValue,
  endValue,
  onChange,
  disabledDates = [],
  minDate,
  maxDate,
  required,
  currentBookingStartDate,
  currentBookingEndDate,
  defaultMonth,
  'data-testid': testId,
}: DateRangePickerProps) {
  const selected: DateRange | undefined = useMemo(() => {
    const from = parseDateOnly(startValue)
    const to = parseDateOnly(endValue)
    return from ? { from, to } : undefined
  }, [startValue, endValue])

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
      list.push((day) => disabledSet.has(formatDateOnly(day)))
    }
    return list
  }, [disabledDates, disabledSet, minDate, maxDate])

  // Create matcher for current booking dates to highlight them
  const currentBookingMatcher: Matcher[] = useMemo(() => {
    const list: Matcher[] = []
    if (currentBookingStartDate) {
      const start = parseDateOnly(currentBookingStartDate)
      const end = parseDateOnly(currentBookingEndDate || currentBookingStartDate)
      if (start && end) {
        // Match all dates in the current booking range
        list.push((day) => {
          const dayStr = formatDateOnly(day)
          const dayDate = parseDateOnly(dayStr)
          return dayDate ? dayDate >= start && dayDate <= end : false
        })
      }
    }
    return list
  }, [currentBookingStartDate, currentBookingEndDate])

  return (
    <div className="space-y-2" data-testid={testId}>
      <label className="block text-sm font-medium">
        {label} {required ? "*" : ""}
      </label>
      <div className="rounded-lg border bg-white p-3">
        {currentBookingStartDate && (
          <div className="mb-2 text-xs space-y-1">
            <div className="flex items-center gap-1 text-gray-600">
              <span className="inline-block w-3 h-3 rounded bg-amber-200 border border-amber-400"></span>
              <span>Current booking date{currentBookingEndDate && currentBookingEndDate !== currentBookingStartDate ? 's' : ''} (still selectable)</span>
            </div>
            <p className="text-gray-500 italic">
              💡 Tip: Select your current date to extend your booking
            </p>
          </div>
        )}
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={(range) => {
            if (!range || !range.from) {
              onChange("", "")
              return
            }
            const fromStr = formatDateOnly(range.from)
            const toStr = range.to ? formatDateOnly(range.to) : fromStr
            onChange(fromStr, toStr)
          }}
          disabled={disabledMatchers}
          modifiers={{
            currentBooking: currentBookingMatcher,
          }}
          defaultMonth={defaultMonth}
          showOutsideDays
          fixedWeeks
          numberOfMonths={1}
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
            currentBooking: {
              backgroundColor: "#fef3c7",
              border: "2px solid #f59e0b",
              fontWeight: 600,
              color: "#92400e",
              cursor: "pointer", // Make it clear it's clickable
            },
          }}
        />
      </div>
    </div>
  )
}

