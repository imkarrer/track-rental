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

interface DayMultipliersDisplayProps {
  trackBasePrice: number
  additionalCarsPrice: number
}

export function DayMultipliersDisplay({
  trackBasePrice,
  additionalCarsPrice: initialAdditionalCarsPrice,
}: DayMultipliersDisplayProps) {
  const [multipliers, setMultipliers] = useState<DayMultiplier[]>([])
  const [holidayMultiplier, setHolidayMultiplier] = useState<number>(1.5)
  const [loading, setLoading] = useState(true)
  const [additionalCarsPrice, setAdditionalCarsPrice] = useState(initialAdditionalCarsPrice)

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

  // Listen for price updates from TrackPriceSummary
  useEffect(() => {
    const handlePriceUpdate = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.additionalCarsPrice !== undefined) {
        setAdditionalCarsPrice(customEvent.detail.additionalCarsPrice)
      }
    }

    window.addEventListener("priceSummaryUpdate", handlePriceUpdate)

    return () => {
      window.removeEventListener("priceSummaryUpdate", handlePriceUpdate)
    }
  }, [])

  if (loading) {
    return null
  }

  const baseTotal = trackBasePrice + additionalCarsPrice

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Day of Week Pricing</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          Base price (track + additional cars): <strong>${baseTotal.toFixed(2)}</strong>
        </p>
        <div className="space-y-2">
          {/* Show all 7 days of the week */}
          {multipliers.map((multiplier) => {
            const projectedPrice = baseTotal * multiplier.multiplier
            const dayName = multiplier.dayName || getDayName(multiplier.dayOfWeek)
            return (
              <div
                key={multiplier.dayOfWeek}
                className="flex items-center justify-between p-2 rounded bg-gray-50"
              >
                <span className="text-sm font-medium">{dayName}:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {multiplier.multiplier}x
                  </span>
                  <span className="text-sm font-semibold">
                    ${projectedPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Show holiday multiplier entry */}
          <div className="flex items-center justify-between p-2 rounded bg-orange-50 border border-orange-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Holiday:</span>
              <span className="text-xs text-orange-600 font-medium">Holiday</span>
              <span className="text-xs text-gray-500">{holidayMultiplier}x</span>
            </div>
            <span className="text-sm font-semibold">
              ${(baseTotal * holidayMultiplier).toFixed(2)}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          * Holiday pricing overrides day-of-week pricing. Multipliers apply to track and cars only. Distance surcharges are not multiplied.
        </p>
      </CardContent>
    </Card>
  )
}

