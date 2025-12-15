"use client"

import { useState, useEffect } from "react"

interface DayMultiplier {
  dayOfWeek: number
  multiplier: number
  dayName?: string
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function getDayAbbr(dayOfWeek: number): string {
  return DAY_ABBR[dayOfWeek] || "?"
}

interface CompactDayPricingProps {
  trackBasePrice: number
  additionalCarsPrice: number
  selectedDate?: string
}

export function CompactDayPricing({
  trackBasePrice,
  additionalCarsPrice,
  selectedDate,
}: CompactDayPricingProps) {
  const [multipliers, setMultipliers] = useState<DayMultiplier[]>([])
  const [holidayMultiplier, setHolidayMultiplier] = useState<number>(1.5)
  const [loading, setLoading] = useState(true)
  const [isSelectedHoliday, setIsSelectedHoliday] = useState<boolean>(false)
  const [selectedHolidayName, setSelectedHolidayName] = useState<string | null>(null)

  useEffect(() => {
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
  const selectedDateObj = selectedDate 
    ? (selectedDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? new Date(selectedDate + "T00:00:00") 
        : new Date(selectedDate))
    : null
  const selectedDayOfWeek = selectedDateObj ? selectedDateObj.getDay() : null

  useEffect(() => {
    if (selectedDate) {
      fetch(`/api/holidays/check?date=${selectedDate}`)
        .then((res) => res.json())
        .then((data) => {
          setIsSelectedHoliday(data.isHoliday || false)
          setSelectedHolidayName(data.holidayName || null)
        })
        .catch(() => {
          setIsSelectedHoliday(false)
          setSelectedHolidayName(null)
        })
    } else {
      setIsSelectedHoliday(false)
      setSelectedHolidayName(null)
    }
  }, [selectedDate])

  if (loading) {
    return null
  }

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-blue-900">📊 Pricing by Day</span>
        {selectedDate && isSelectedHoliday && selectedHolidayName && (
          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-medium">
            {selectedHolidayName}
          </span>
        )}
      </div>
      
      <p className="text-xs text-blue-800 mb-2">
        Base: ${baseTotal.toFixed(2)} (track + cars)
      </p>

      {/* Days of week grid */}
      <div className="grid grid-cols-4 gap-1 mb-2">
        {multipliers.map((multiplier) => {
          const projectedPrice = baseTotal * multiplier.multiplier
          const isSelected = !isSelectedHoliday && selectedDayOfWeek === multiplier.dayOfWeek
          const dayAbbr = getDayAbbr(multiplier.dayOfWeek)

          return (
            <div
              key={multiplier.dayOfWeek}
              className={`text-center p-1.5 rounded text-xs ${
                isSelected
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-white text-gray-700 border border-gray-200"
              }`}
            >
              <div className="font-medium">{dayAbbr}</div>
              <div className="text-[10px] leading-tight">
                {multiplier.multiplier}x
              </div>
              <div className="text-[10px] font-semibold leading-tight">
                ${projectedPrice.toFixed(0)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Holiday pricing */}
      <div
        className={`text-center p-1.5 rounded text-xs ${
          isSelectedHoliday
            ? "bg-orange-500 text-white font-semibold"
            : "bg-orange-100 text-orange-800 border border-orange-200"
        }`}
      >
        <span className="font-medium">Holiday: </span>
        <span>{holidayMultiplier}x = ${(baseTotal * holidayMultiplier).toFixed(0)}</span>
      </div>

      <p className="text-[10px] text-blue-700 mt-2 italic">
        * Distance surcharges not included
      </p>
    </div>
  )
}
