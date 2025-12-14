"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type LoadState = "idle" | "loading" | "saving" | "error" | "success"

export function ReminderSchedule() {
  const [offsets, setOffsets] = useState<string>("3,1")
  const [status, setStatus] = useState<LoadState>("idle")
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    const load = async () => {
      setStatus("loading")
      try {
        const res = await fetch("/api/admin/reminders/config")
        const data = await res.json()
        if (res.ok && Array.isArray(data.offsets)) {
          setOffsets(data.offsets.join(","))
        } else {
          throw new Error(data.error || "Failed to load reminder config")
        }
        setStatus("idle")
      } catch (error: any) {
        setStatus("error")
        setMessage(error?.message || "Failed to load")
      }
    }
    load()
  }, [])

  const save = async () => {
    setStatus("saving")
    setMessage("")
    try {
      const parsed = offsets
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))

      const res = await fetch("/api/admin/reminders/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offsets: parsed }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to save reminder config")
      }
      setOffsets(data.offsets.join(","))
      setStatus("success")
      setMessage("Reminder schedule saved")
    } catch (error: any) {
      setStatus("error")
      setMessage(error?.message || "Failed to save")
    } finally {
      setTimeout(() => {
        setStatus("idle")
      }, 1200)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminder Schedule</CardTitle>
        <CardDescription>
          Configure days-before-event to send reminders (comma-separated, e.g., 3,1).
          Applied to email and SMS reminders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 items-center">
          <Input
            value={offsets}
            onChange={(e) => setOffsets(e.target.value)}
            placeholder="3,1"
            className="max-w-xs"
          />
          <Button onClick={save} disabled={status === "saving" || status === "loading"}>
            {status === "saving" ? "Saving..." : "Save"}
          </Button>
        </div>
        {message && (
          <p
            className={`text-sm ${
              status === "error" ? "text-red-600" : "text-green-600"
            }`}
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}


