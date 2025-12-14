"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { formatDateWithWeekdayUTC } from "@/lib/date/format"

interface RescheduleDialogProps {
  bookingId: string
  currentDate: string // YYYY-MM-DD
  currentTotal: number
  trackName: string
  onRescheduleComplete: () => void
}

interface ReschedulePreview {
  oldEventDate: string
  newEventDate: string
  oldMultiplier: number
  newMultiplier: number
  oldTotal: number
  newTotal: number
  action: "refund" | "payment" | "none"
  amount: number
  refundPercent: number
  promoCode: string | null
  promoCodePreserved: boolean
}

export function RescheduleDialog({
  bookingId,
  currentDate,
  currentTotal,
  trackName,
  onRescheduleComplete,
}: RescheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [newDate, setNewDate] = useState("")
  const [preview, setPreview] = useState<ReschedulePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const handlePreview = async () => {
    if (!newDate) {
      setError("Please select a new date")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          newEventDate: newDate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate reschedule")
      }

      setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview reschedule")
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return

    setConfirming(true)
    setError(null)

    try {
      let paymentIntentId: string | undefined

      // If action is "payment", we need to process payment first
      if (preview.action === "payment") {
        // For now, show a simplified message
        // In a full implementation, we would integrate Stripe Elements here
        setError(
          "Payment for date upgrades requires additional setup. Please contact support to complete this reschedule."
        )
        setConfirming(false)
        return
      }

      // Execute the reschedule
      const response = await fetch("/api/bookings/reschedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          newEventDate: newDate,
          paymentIntentId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reschedule booking")
      }

      // Success!
      setOpen(false)
      setPreview(null)
      setNewDate("")
      onRescheduleComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm reschedule")
    } finally {
      setConfirming(false)
    }
  }

  const handleReset = () => {
    setNewDate("")
    setPreview(null)
    setError(null)
  }

  // Get minimum date (tomorrow)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split("T")[0]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          📅 Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
          <DialogDescription>
            Change your booking date for {trackName}. Pricing adjustments will apply
            based on our refund policy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current booking info */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Current Date</p>
                  <p className="font-semibold">
                    {formatDateWithWeekdayUTC(currentDate)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Current Total</p>
                  <p className="font-semibold">${currentTotal.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date selector */}
          <div>
            <Label htmlFor="newDate">New Date</Label>
            <Input
              id="newDate"
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value)
                setPreview(null) // Clear preview when date changes
                setError(null)
              }}
              min={minDate}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Select a new date for your booking
            </p>
          </div>

          {/* Preview button */}
          {!preview && (
            <Button
              onClick={handlePreview}
              disabled={!newDate || loading}
              className="w-full"
            >
              {loading ? "Calculating..." : "Preview Changes"}
            </Button>
          )}

          {/* Error message */}
          {error && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-4">
                <p className="text-red-700 text-sm">⚠️ {error}</p>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-4">
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="pt-4 space-y-3">
                  <h3 className="font-semibold text-lg">Preview Changes</h3>

                  {/* Day multiplier info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Old Day Rate</p>
                      <p className="font-semibold">{preview.oldMultiplier}x</p>
                    </div>
                    <div>
                      <p className="text-gray-600">New Day Rate</p>
                      <p className="font-semibold">{preview.newMultiplier}x</p>
                    </div>
                  </div>

                  {/* Price changes */}
                  <div className="border-t pt-3">
                    <div className="flex justify-between mb-2">
                      <span>Original Total:</span>
                      <span className="line-through">
                        ${preview.oldTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>New Total:</span>
                      <span className="font-bold">
                        ${preview.newTotal.toFixed(2)}
                      </span>
                    </div>

                    {/* Action */}
                    {preview.action === "refund" && (
                      <div className="mt-3 p-3 bg-green-100 rounded border border-green-300">
                        <p className="font-semibold text-green-800">
                          💰 Refund: ${preview.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          Based on {preview.refundPercent}% refund policy (canceling{" "}
                          {Math.floor(
                            (new Date(currentDate).getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24)
                          )}{" "}
                          days before original date)
                        </p>
                      </div>
                    )}

                    {preview.action === "payment" && (
                      <div className="mt-3 p-3 bg-orange-100 rounded border border-orange-300">
                        <p className="font-semibold text-orange-800">
                          💳 Additional Payment: ${preview.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-orange-700 mt-1">
                          You&apos;re upgrading to a more expensive day
                        </p>
                      </div>
                    )}

                    {preview.action === "none" && (
                      <div className="mt-3 p-3 bg-gray-100 rounded border border-gray-300">
                        <p className="font-semibold text-gray-800">
                          ✓ No price change
                        </p>
                        <p className="text-xs text-gray-700 mt-1">
                          Same day rate, no refund or payment needed
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Promo code preservation */}
                  {preview.promoCodePreserved && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-green-700">
                        ✅ Promo code <strong>{preview.promoCode}</strong> will be
                        preserved
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Confirm buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={confirming}
                  className="flex-1"
                >
                  Change Date
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex-1"
                >
                  {confirming ? "Processing..." : "Confirm Reschedule"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

