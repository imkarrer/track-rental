"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ListedHoliday {
  id: string
  name: string
  date: string
  multiplier: number
  isRecurring: boolean
  year: number
}

export default function HolidayRulesPage() {
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [holidays, setHolidays] = useState<ListedHoliday[]>([])
  const [globalMultiplier, setGlobalMultiplier] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [multiplierInput, setMultiplierInput] = useState<string>("")

  const loadData = async (year: number) => {
    setLoading(true)
    try {
      const [multRes, listRes] = await Promise.all([
        fetch("/api/holidays/multiplier"),
        fetch(`/api/holidays/list?year=${year}`),
      ])

      if (multRes.ok) {
        const data = await multRes.json()
        setGlobalMultiplier(data.multiplier ?? null)
        setMultiplierInput((data.multiplier ?? 1.5).toString())
      }

      if (listRes.ok) {
        const data = await listRes.json()
        setHolidays(data.holidays || [])
      }
    } catch (error) {
      console.error("Error loading holiday data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(selectedYear)
  }, [selectedYear])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">⏳ Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <span className="text-4xl">🎉</span>
            Holiday Pricing (Single Multiplier)
          </h2>
          <p className="text-gray-600 mt-2">
            All holidays share one multiplier. Dates auto-calculate every year.
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-1.5 border rounded-md bg-white"
        >
          {Array.from({ length: 5 }, (_, i) => {
            const year = new Date().getFullYear() + i - 1
            return (
              <option key={year} value={year}>
                {year}
              </option>
            )
          })}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>💰 Global Holiday Multiplier</CardTitle>
          <CardDescription>Applied to every holiday date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-600 text-base px-3 py-1">
                {globalMultiplier ?? "—"}x
              </Badge>
              <p className="text-sm text-gray-700">
                All holidays share this multiplier.
              </p>
            </div>
            <form
              className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
              onSubmit={async (e) => {
                e.preventDefault()
                const parsed = parseFloat(multiplierInput)
                if (isNaN(parsed) || parsed <= 0) {
                  alert("Please enter a valid multiplier greater than 0.")
                  return
                }
                setSaving(true)
                try {
                  const res = await fetch("/api/admin/fixed-costs", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ holidayMultiplier: parsed }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    alert(err.error || "Failed to save multiplier")
                    return
                  }
                  setGlobalMultiplier(parsed)
                  alert("Holiday multiplier updated.")
                } catch (err) {
                  console.error(err)
                  alert("Failed to save multiplier")
                } finally {
                  setSaving(false)
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={multiplierInput}
                  onChange={(e) => setMultiplierInput(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">x</span>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📅 Holidays for {selectedYear}</CardTitle>
          <CardDescription>US federal holidays with the shared multiplier</CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-center text-gray-500 py-6">No holidays available.</p>
          ) : (
            <div className="space-y-2">
              {holidays.map((holiday) => {
                const dateLabel = new Date(holiday.date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric", year: "numeric" }
                )
                return (
                  <div
                    key={`${holiday.id}-${holiday.date}`}
                    className="p-3 border rounded-lg bg-gradient-to-r from-blue-50 to-white flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold">{holiday.name}</h4>
                      <p className="text-sm text-gray-600">{dateLabel}</p>
                    </div>
                    <Badge className="bg-blue-600">{holiday.multiplier}x</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ℹ️ Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>• Holidays are pre-defined US federal dates with weekend observance.</p>
          <p>• All holidays share one multiplier; there are no per-holiday overrides.</p>
          <p>• Dates auto-refresh each year—no manual rule maintenance needed.</p>
        </CardContent>
      </Card>
    </div>
  )
}

