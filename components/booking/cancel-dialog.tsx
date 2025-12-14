"use client"

import { useEffect, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { formatDateWithWeekdayUTC } from "@/lib/date/format"

type CancelPreview = {
  bookingId: string
  bookingStatus: string
  eventDate: string
  bookingTotal: number
  alreadyRefunded: number
  refundableAmount: number
  nonRefundableAmount: number
  remainingRefundable: number
  daysBeforeService: number
  policyUsed: { daysBeforeService: number; nonRefundablePercent: number } | null
  canCancel: boolean
  requiresManualHelp?: boolean
}

interface CancelBookingDialogProps {
  bookingId: string
  trackName: string
  eventDate: string
  onCancelComplete: () => void
}

export function CancelBookingDialog({
  bookingId,
  trackName,
  eventDate,
  onCancelComplete,
}: CancelBookingDialogProps) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<CancelPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setError(null)
      setPreview(null)
      setReason("")
      setSuccessMessage(null)
      return
    }

    const loadPreview = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/bookings/${bookingId}/cancel`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to load cancellation details")
        }
        setPreview(data)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load cancellation details"
        )
      } finally {
        setLoading(false)
      }
    }

    loadPreview()
  }, [bookingId, open])

  const handleCancel = async () => {
    if (!preview?.canCancel) {
      setError(
        "This booking is not eligible for self-service cancellation. Please contact support."
      )
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel booking")
      }

      const refundText =
        data.refundAmount && Number(data.refundAmount) > 0
          ? `Refund processed: $${Number(data.refundAmount).toFixed(2)}`
          : "Cancellation completed."

      setSuccessMessage(refundText)

      // Give the user a moment to read, then close and let parent handle refresh
      setTimeout(() => {
        setOpen(false)
        onCancelComplete() // Parent will call router.refresh()
      }, 1800)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel booking. Try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const refundLabel =
    preview && preview.remainingRefundable >= 0
      ? `$${preview.remainingRefundable.toFixed(2)}`
      : "$0.00"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid={`booking-cancel-button-${bookingId}`} variant="destructive" size="sm" className="w-full text-xs py-1 h-7">
          ✂️ Cancel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cancel booking</DialogTitle>
          <DialogDescription>
            We&apos;ll apply the refund policy automatically for your{" "}
            {trackName} booking.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-gray-600">Loading cancellation details...</p>
        )}

        {!loading && preview && (
          <div className="space-y-4">
            <Card className="bg-gray-50">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Event date</span>
                  <span className="font-semibold">
                    {formatDateWithWeekdayUTC(eventDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Eligible refund</span>
                  <span className="font-semibold text-green-700">{refundLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Non-refundable</span>
                  <span className="font-semibold text-gray-700">
                    ${preview.nonRefundableAmount.toFixed(2)}
                  </span>
                </div>
                {preview.policyUsed && (
                  <p className="text-xs text-gray-600">
                    Policy applied: {preview.policyUsed.nonRefundablePercent}% non-refundable when
                    cancelling {preview.policyUsed.daysBeforeService}+ days before the event.
                  </p>
                )}
                {preview.requiresManualHelp && (
                  <p className="text-xs text-red-700">
                    We could not find a payment for this booking. Please contact support to refund.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Add context for the cancellation"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {error && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-3">
                  <p className="text-sm text-red-700">⚠️ {error}</p>
                </CardContent>
              </Card>
            )}

            {successMessage && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-3">
                  <p className="text-sm text-green-800">✅ {successMessage}</p>
                  <p className="text-xs text-green-700 mt-1">
                    Closing in a moment...
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                data-testid="cancel-dialog-keep-button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="w-1/2"
              >
                Keep Booking
              </Button>
              <Button
                data-testid="cancel-dialog-confirm-button"
                variant="destructive"
                onClick={handleCancel}
                disabled={
                  submitting || loading || !preview?.canCancel || Boolean(successMessage)
                }
                className="w-1/2"
              >
                {submitting
                  ? "Cancelling..."
                  : successMessage
                  ? "Cancelled"
                  : preview
                  ? `Cancel & refund ${refundLabel}`
                  : "Cancel booking"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


