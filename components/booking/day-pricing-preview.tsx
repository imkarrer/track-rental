"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DayMultiplier {
  dayOfWeek: number
  multiplier: number
  dayName?: string
}

// No longer need individual holiday interface

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || "Unknown"
}

interface DayPricingPreviewProps {
  trackBasePrice: number
  additionalCarsPrice: number
  selectedDate?: string
  onDaySelected?: (dayOfWeek: number, multiplier: number) => void
}

// Helper to get formData - we'll need to pass it or calculate it

export function DayPricingPreview({
  trackBasePrice,
  additionalCarsPrice,
  selectedDate,
  onDaySelected,
}: DayPricingPreviewProps) {
  const [multipliers, setMultipliers] = useState<DayMultiplier[]>([])
  const [holidayMultiplier, setHolidayMultiplier] = useState<number>(1.5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch day multipliers and global holiday multiplier
    Promise.all([
      fetch("/api/day-multipliers").then((res) => res.json()),
      fetch("/api/holidays/multiplier").then((res) => res.json()),
    ])
      .then(([multipliersData, holidayData]) => {
        setMultipliers(multipliersData.multipliers || [])
        setHolidayMultiplier(holidayData.multiplier || 1.5)
      })
      .catch((error) => {
        console.error("Error fetching multipliers/holiday:", error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const baseTotal = trackBasePrice + additionalCarsPrice
  // Parse date - if it's YYYY-MM-DD format, use it directly, otherwise parse with time
  const selectedDateStr = selectedDate || null
  const selectedDateObj = selectedDate 
    ? (selectedDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? new Date(selectedDate + "T00:00:00") 
        : new Date(selectedDate))
    : null
  const selectedDayOfWeek = selectedDateObj ? selectedDateObj.getDay() : null

  // Check if selected date is a holiday and get holiday name
  const [isSelectedHoliday, setIsSelectedHoliday] = useState<boolean>(false)
  const [selectedHolidayName, setSelectedHolidayName] = useState<string | null>(null)
  
  useEffect(() => {
    if (!selectedDateStr) {
      setIsSelectedHoliday(false)
      setSelectedHolidayName(null)
      return
    }
    
    let cancelled = false
    fetch(`/api/holidays/check?date=${selectedDateStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setIsSelectedHoliday(data.isHoliday || false)
          setSelectedHolidayName(data.holidayName || null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsSelectedHoliday(false)
          setSelectedHolidayName(null)
        }
      })
    
    return () => { cancelled = true }
  }, [selectedDateStr])

  // Get multiplier: holiday first, then day-of-week
  const selectedMultiplier = selectedDateStr
    ? isSelectedHoliday
      ? holidayMultiplier
      : multipliers.find((m) => m.dayOfWeek === selectedDayOfWeek)?.multiplier || 1.0
    : null

  if (loading) {
    return null
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Day of Week Pricing</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          Base price (track + additional cars): <strong>${baseTotal.toFixed(2)}</strong>
        </p>

        <div className="space-y-3">
          {/* Row 1: all days of the week */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {multipliers.map((multiplier) => {
              const projectedPrice = baseTotal * multiplier.multiplier
              const isSelected =
                !isSelectedHoliday && selectedDayOfWeek === multiplier.dayOfWeek
              const dayName = multiplier.dayName || getDayName(multiplier.dayOfWeek)

              return (
                <div
                  key={multiplier.dayOfWeek}
                  className={`min-w-[140px] flex flex-col gap-1 p-3 rounded border transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-blue-300"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{dayName}</span>
                    {isSelected && (
                      <span className="text-xs text-blue-600 font-medium">Selected</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      {multiplier.multiplier}x = ${projectedPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Row 2: holiday rate */}
          <div
            className={`flex items-center justify-between p-3 rounded border transition-colors ${
              isSelectedHoliday
                ? "bg-orange-50 border-orange-300"
                : "bg-orange-50/50 border-orange-200 hover:bg-orange-100"
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {isSelectedHoliday && selectedHolidayName
                  ? `${selectedHolidayName} (Holiday):`
                  : "Holiday:"}
              </span>
              <span className="text-sm text-gray-700">
                {holidayMultiplier}x = ${(baseTotal * holidayMultiplier).toFixed(2)}
              </span>
            </div>
            {isSelectedHoliday && (
              <span className="text-xs text-orange-600 font-medium">Selected</span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          * Multipliers apply to track and cars only. Distance surcharges are not multiplied.
        </p>
      </CardContent>
    </Card>
  )
}

