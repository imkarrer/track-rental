"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DayMultiplier {
  dayOfWeek: number
  multiplier: number
  dayName: string
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export default function DayMultipliersPage() {
  const [multipliers, setMultipliers] = useState<DayMultiplier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMultipliers()
  }, [])

  const fetchMultipliers = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/day-multipliers")
      if (response.ok) {
        const data = await response.json()
        // Ensure we have all 7 days and convert multipliers to numbers
        const allDays = Array.from({ length: 7 }, (_, i) => {
          const existing = data.multipliers.find((m: DayMultiplier) => m.dayOfWeek === i)
          if (existing) {
            return {
              dayOfWeek: existing.dayOfWeek,
              multiplier: typeof existing.multiplier === 'string' ? parseFloat(existing.multiplier) : Number(existing.multiplier),
              dayName: existing.dayName || DAY_NAMES[i],
            }
          }
          return {
            dayOfWeek: i,
            multiplier: i === 0 ? 1.3 : i >= 1 && i <= 4 ? 1.0 : i === 5 ? 1.2 : 1.5,
            dayName: DAY_NAMES[i],
          }
        })
        setMultipliers(allDays)
      }
    } catch (error) {
      console.error("Error fetching multipliers:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMultiplierChange = (dayOfWeek: number, value: string) => {
    setMultipliers((prev) =>
      prev.map((m) =>
        m.dayOfWeek === dayOfWeek
          ? { ...m, multiplier: parseFloat(value) || 0 }
          : m
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Ensure all multipliers are numbers before sending
      const multipliersToSend = multipliers.map((m) => ({
        dayOfWeek: Number(m.dayOfWeek),
        multiplier: Number(m.multiplier),
        dayName: m.dayName,
      }))
      
      const response = await fetch("/api/admin/day-multipliers", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ multipliers: multipliersToSend }),
      })

      if (response.ok) {
        alert("Day multipliers updated successfully!")
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update multipliers")
      }
    } catch (error) {
      console.error("Error updating multipliers:", error)
      alert("Failed to update multipliers")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">Loading multipliers...</div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Day of Week Multipliers</h2>
        <p className="text-gray-600 mt-2">
          Set multipliers for each day of the week. These multipliers apply to the track base price and additional cars, but not to distance surcharges.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Multipliers</CardTitle>
          <CardDescription>
            Adjust the pricing multiplier for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {multipliers.map((multiplier) => (
                <div key={multiplier.dayOfWeek} className="space-y-2">
                  <Label htmlFor={`day-${multiplier.dayOfWeek}`}>
                    {multiplier.dayName}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`day-${multiplier.dayOfWeek}`}
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={multiplier.multiplier}
                      onChange={(e) =>
                        handleMultiplierChange(multiplier.dayOfWeek, e.target.value)
                      }
                      required
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500">x</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Example: 1.5 = 50% increase, 0.8 = 20% discount
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Multipliers"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={fetchMultipliers}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>
            • Multipliers apply to: <strong>Track Base Price + Additional Cars</strong>
          </p>
          <p>
            • Multipliers do <strong>NOT</strong> apply to: Distance surcharges, setup fees, or taxes
          </p>
          <p>
            • Example: If track is $350 and multiplier is 1.5x, the track price becomes $525
          </p>
          <p>
            • Additional cars are also multiplied by the same factor
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

