"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface Booking {
  id: string
  total: number
  totalRefunded: number
  status: string
  paymentIntentId: string | null
  eventDate: string
}

interface RefundCalculation {
  nonRefundableAmount: number
  refundableAmount: number
  daysBeforeService: number
  policyUsed: { daysBeforeService: number; nonRefundablePercent: number } | null
  bookingTotal: number
  alreadyRefunded: number
  maxRefundable: number
  remainingRefundable: number
  canRefundFull: boolean
}

interface RefundBreakdown {
  originalTotal: number
  currentBookingTotal: number
  reschedulingPenalty: number
  cancellationPenalty: number
  alreadyRefunded: number
  currentRefundable: number
  remainingRefundable: number
  fullRefundAvailable: number
  breakdown: {
    originalAmountPaid: number
    reschedulingPenalties: number
    currentBookingValue: number
    alreadyRefunded: number
    cancellationPenalty: number
    remainingRefundablePerPolicy: number
    fullRefundAvailableWithOverride: number
  }
}

interface BookingManagementProps {
  booking: Booking
  refundCalculation: RefundCalculation
}

export function BookingManagement({
  booking,
  refundCalculation,
}: BookingManagementProps) {
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [adminOverride, setAdminOverride] = useState(false)
  const [selectiveRefund, setSelectiveRefund] = useState(false)
  const [breakdown, setBreakdown] = useState<RefundBreakdown | null>(null)
  const [loadingBreakdown, setLoadingBreakdown] = useState(true)
  const [refundForm, setRefundForm] = useState({
    amount: refundCalculation.remainingRefundable.toFixed(2),
    refundType: "PARTIAL" as "FULL" | "PARTIAL" | "ADMIN_DISCRETION",
    reason: "",
    circumstances: "",
    notes: "",
  })

  // Fetch refund breakdown on mount
  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        const response = await fetch(`/api/admin/bookings/${booking.id}/refund-breakdown`)
        if (response.ok) {
          const data = await response.json()
          setBreakdown(data)
        }
      } catch (error) {
        console.error("Error fetching refund breakdown:", error)
      } finally {
        setLoadingBreakdown(false)
      }
    }

    fetchBreakdown()
  }, [booking.id])

  // Calculate the maximum refundable with override
  const bookingTotal = Number(booking.total)
  const alreadyRefunded = Number(booking.totalRefunded)
  const maxRefundableWithOverride = Math.max(0, bookingTotal - alreadyRefunded)
  const maxRefundableWithSelective = breakdown 
    ? Math.max(0, breakdown.fullRefundAvailable)
    : maxRefundableWithOverride

  const handleRefund = async () => {
    // Validate required fields when admin override is enabled
    if (adminOverride) {
      if (!refundForm.circumstances.trim()) {
        alert("Cancellation circumstances are required when using admin override")
        return
      }
      if (!refundForm.reason.trim()) {
        alert("Refund reason is required when using admin override")
        return
      }
      if (!refundForm.notes.trim()) {
        alert("Admin notes are required when using admin override - please explain the justification")
        return
      }
    }

    const confirmMessage = selectiveRefund && adminOverride
      ? `Process refund of $${refundForm.amount}?\n\n⚠️ This uses SELECTIVE REFUND with ADMIN OVERRIDE to refund rescheduling penalties.\n\nOriginal amount: $${breakdown?.originalTotal.toFixed(2) || "0.00"}\nRescheduling penalty: $${breakdown?.reschedulingPenalty.toFixed(2) || "0.00"}\nAlready refunded: $${alreadyRefunded.toFixed(2)}`
      : adminOverride
      ? `Process refund of $${refundForm.amount}?\n\n⚠️ This uses ADMIN OVERRIDE to bypass the refund policy.`
      : `Process refund of $${refundForm.amount}?`

    if (!confirm(confirmMessage)) {
      return
    }

    setProcessing(true)
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(refundForm.amount),
          refundType: refundForm.refundType,
          reason: refundForm.reason || null,
          circumstances: refundForm.circumstances || null,
          notes: refundForm.notes || null,
          adminOverride,
          selectiveRefund: selectiveRefund && adminOverride,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to process refund")
        return
      }

      alert("Refund processed successfully!")
      setIsRefundDialogOpen(false)
      window.location.reload()
    } catch (error) {
      console.error("Error processing refund:", error)
      alert("Failed to process refund")
    } finally {
      setProcessing(false)
    }
  }

  const setFullRefund = () => {
    const maxAmount = selectiveRefund && adminOverride && breakdown
      ? breakdown.fullRefundAvailable
      : adminOverride 
      ? maxRefundableWithOverride 
      : refundCalculation.remainingRefundable
    setRefundForm({
      ...refundForm,
      amount: maxAmount.toFixed(2),
      refundType: "FULL",
    })
  }

  const setPartialRefund = () => {
    setRefundForm({
      ...refundForm,
      refundType: "PARTIAL",
    })
  }

  const toggleAdminOverride = () => {
    const newOverrideState = !adminOverride
    setAdminOverride(newOverrideState)
    
    // Disable selective refund if admin override is disabled
    if (!newOverrideState) {
      setSelectiveRefund(false)
    }
    
    // Update the amount if switching to override and current amount exceeds remaining
    if (newOverrideState) {
      setRefundForm({
        ...refundForm,
        refundType: "ADMIN_DISCRETION",
      })
    }
  }

  const toggleSelectiveRefund = () => {
    const newSelectiveState = !selectiveRefund
    setSelectiveRefund(newSelectiveState)
    
    // Update amount if switching to selective refund
    if (newSelectiveState && adminOverride && breakdown) {
      setRefundForm({
        ...refundForm,
        amount: breakdown.fullRefundAvailable.toFixed(2),
      })
    } else if (!newSelectiveState && adminOverride) {
      setRefundForm({
        ...refundForm,
        amount: maxRefundableWithOverride.toFixed(2),
      })
    }
  }

  if (!booking.paymentIntentId) {
    return null // Can't refund without payment intent
  }

  const hasReschedulingPenalty = breakdown && breakdown.reschedulingPenalty > 0
  const showSelectiveRefund = hasReschedulingPenalty && adminOverride

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund Management</CardTitle>
        <CardDescription>
          Process full or partial refunds based on cancellation policy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Refund Calculation Display */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="font-semibold">Current Booking Total:</span>
            <span>${refundCalculation.bookingTotal.toFixed(2)}</span>
          </div>
          {breakdown && breakdown.originalTotal !== breakdown.currentBookingTotal && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Original Amount Paid:</span>
              <span>${breakdown.originalTotal.toFixed(2)}</span>
            </div>
          )}
          {breakdown && breakdown.reschedulingPenalty > 0 && (
            <div className="flex justify-between text-sm text-orange-700">
              <span>Rescheduling Penalty:</span>
              <span>-${breakdown.reschedulingPenalty.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Already Refunded:</span>
            <span className="text-red-600">
              -${refundCalculation.alreadyRefunded.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Non-Refundable Amount:</span>
            <span className="text-orange-600">
              ${refundCalculation.nonRefundableAmount.toFixed(2)}
            </span>
          </div>
          {refundCalculation.policyUsed && (
            <div className="text-sm text-gray-600">
              Policy: {refundCalculation.policyUsed.daysBeforeService}+ days ={" "}
              {refundCalculation.policyUsed.nonRefundablePercent}% non-refundable
            </div>
          )}
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-semibold">Remaining Refundable:</span>
            <span className="font-semibold text-green-600">
              ${refundCalculation.remainingRefundable.toFixed(2)}
            </span>
          </div>
          {breakdown && breakdown.fullRefundAvailable > refundCalculation.remainingRefundable && (
            <div className="flex justify-between text-sm text-blue-700 border-t pt-2 mt-2">
              <span className="font-semibold">Full Refund Available (with override):</span>
              <span className="font-semibold">
                ${breakdown.fullRefundAvailable.toFixed(2)}
              </span>
            </div>
          )}
          <div className="text-sm text-gray-500">
            Days before service: {refundCalculation.daysBeforeService}
          </div>
        </div>

        {/* Selective Refund Notice */}
        {breakdown && hasReschedulingPenalty && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-purple-600 text-lg">💡</span>
              <div className="flex-1">
                <p className="text-sm text-purple-900 font-semibold">
                  Rescheduling Penalty Detected
                </p>
                <p className="text-sm text-purple-800 mt-1">
                  This booking has a rescheduling penalty of <strong>${breakdown.reschedulingPenalty.toFixed(2)}</strong> that cannot be refunded through normal policy. 
                  Use <strong>Selective Refund</strong> with Admin Override to refund the original amount of <strong>${breakdown.originalTotal.toFixed(2)}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Override Notice */}
        {refundCalculation.nonRefundableAmount > 0 && maxRefundableWithOverride > refundCalculation.remainingRefundable && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 text-lg">ℹ️</span>
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-semibold">
                  Policy Restriction in Effect
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  The refund policy restricts this refund to ${refundCalculation.remainingRefundable.toFixed(2)}. 
                  However, you can use <strong>Admin Override</strong> to issue a full refund of up to ${maxRefundableWithOverride.toFixed(2)} if circumstances warrant it.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Refund Actions */}
        {(refundCalculation.remainingRefundable > 0 || maxRefundableWithOverride > 0 || (breakdown && breakdown.fullRefundAvailable > 0)) && (
          <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
            <DialogTrigger asChild>
              <Button>💰 Process Refund</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Process Refund</DialogTitle>
                <DialogDescription>
                  Process a full or partial refund for this booking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Refund Breakdown */}
                {breakdown && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Refund Breakdown</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Original Amount Paid:</span>
                        <span className="font-medium">${breakdown.originalTotal.toFixed(2)}</span>
                      </div>
                      {breakdown.reschedulingPenalty > 0 && (
                        <div className="flex justify-between text-orange-700">
                          <span>Rescheduling Penalty:</span>
                          <span>-${breakdown.reschedulingPenalty.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Current Booking Value:</span>
                        <span>${breakdown.currentBookingTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Already Refunded:</span>
                        <span>-${breakdown.alreadyRefunded.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                        <span>Full Refund Available:</span>
                        <span className="text-green-700">${breakdown.fullRefundAvailable.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Override Toggle */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="adminOverride"
                      checked={adminOverride}
                      onChange={toggleAdminOverride}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <label htmlFor="adminOverride" className="font-semibold text-amber-900 cursor-pointer flex items-center gap-2">
                        <span>⚠️ Admin Override - Full Refund Authority</span>
                      </label>
                      <p className="text-sm text-amber-800 mt-1">
                        Enable this to override the refund policy and issue a full refund regardless of cancellation timing. 
                        {breakdown && breakdown.fullRefundAvailable > maxRefundableWithOverride ? (
                          <> This will refund up to <strong>${breakdown.fullRefundAvailable.toFixed(2)}</strong> (original amount minus already refunded) if selective refund is enabled.</>
                        ) : (
                          <> This will refund up to <strong>${maxRefundableWithOverride.toFixed(2)}</strong> (total booking amount minus already refunded).</>
                        )}
                      </p>
                      {adminOverride && (
                        <p className="text-sm text-amber-900 font-semibold mt-2">
                          ⚠️ Override active: You can refund beyond the normal policy limits. Please document the reason below.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selective Refund Toggle */}
                {hasReschedulingPenalty && (
                  <div className={`border rounded-lg p-4 ${adminOverride ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="selectiveRefund"
                        checked={selectiveRefund}
                        onChange={toggleSelectiveRefund}
                        disabled={!adminOverride}
                        className="mt-1 h-4 w-4 rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <label htmlFor="selectiveRefund" className={`font-semibold flex items-center gap-2 ${adminOverride ? 'text-purple-900 cursor-pointer' : 'text-gray-600 cursor-not-allowed'}`}>
                          <span>🎯 Selective Refund - Include Rescheduling Penalties</span>
                        </label>
                        {!adminOverride ? (
                          <p className="text-sm text-gray-600 mt-1">
                            Enable Admin Override first to use selective refund. This will refund the original booking amount including rescheduling penalties of <strong>${breakdown?.reschedulingPenalty.toFixed(2) || "0.00"}</strong>.
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-purple-800 mt-1">
                              Enable this to refund the original booking amount including rescheduling penalties. 
                              This will refund up to <strong>${breakdown?.fullRefundAvailable.toFixed(2) || "0.00"}</strong> (original ${breakdown?.originalTotal.toFixed(2) || "0.00"} minus already refunded ${alreadyRefunded.toFixed(2)}).
                            </p>
                            {selectiveRefund && (
                              <p className="text-sm text-purple-900 font-semibold mt-2">
                                ✅ Selective refund active: Will refund rescheduling penalty of ${breakdown?.reschedulingPenalty.toFixed(2) || "0.00"}.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Refund Type</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant={
                        refundForm.refundType === "FULL"
                          ? "default"
                          : "outline"
                      }
                      onClick={setFullRefund}
                    >
                      {selectiveRefund && adminOverride ? "💯 Full Refund (Selective)" : adminOverride ? "💯 Full Refund (Override)" : "Full Refund"}
                    </Button>
                    <Button
                      type="button"
                      variant={
                        refundForm.refundType === "PARTIAL"
                          ? "default"
                          : "outline"
                      }
                      onClick={setPartialRefund}
                    >
                      Partial Refund
                    </Button>
                    <Button
                      type="button"
                      variant={
                        refundForm.refundType === "ADMIN_DISCRETION"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setRefundForm({ ...refundForm, refundType: "ADMIN_DISCRETION" })
                      }
                    >
                      Admin Discretion
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="refundAmount">Refund Amount ($)</Label>
                  <Input
                    id="refundAmount"
                    type="number"
                    min="0.01"
                    max={selectiveRefund && adminOverride && breakdown ? breakdown.fullRefundAvailable : adminOverride ? maxRefundableWithOverride : refundCalculation.remainingRefundable}
                    step="0.01"
                    value={refundForm.amount}
                    onChange={(e) =>
                      setRefundForm({ ...refundForm, amount: e.target.value })
                    }
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {selectiveRefund && adminOverride && breakdown ? (
                      <span className="text-purple-700 font-semibold">
                        Maximum with selective refund: ${breakdown.fullRefundAvailable.toFixed(2)}
                      </span>
                    ) : adminOverride ? (
                      <span className="text-amber-700 font-semibold">
                        Maximum with override: ${maxRefundableWithOverride.toFixed(2)}
                      </span>
                    ) : (
                      <span>
                        Maximum per policy: ${refundCalculation.remainingRefundable.toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <Label htmlFor="circumstances">
                    Cancellation Circumstances {adminOverride && <span className="text-red-600">*</span>}
                  </Label>
                  <Textarea
                    id="circumstances"
                    value={refundForm.circumstances}
                    onChange={(e) =>
                      setRefundForm({ ...refundForm, circumstances: e.target.value })
                    }
                    placeholder="e.g., Customer requested cancellation, Weather-related, etc."
                    rows={3}
                    required={adminOverride}
                  />
                  {adminOverride && (
                    <p className="text-sm text-amber-700 mt-1">
                      Required when using admin override
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reason">Refund Reason {adminOverride && <span className="text-red-600">*</span>}</Label>
                  <Textarea
                    id="reason"
                    value={refundForm.reason}
                    onChange={(e) =>
                      setRefundForm({ ...refundForm, reason: e.target.value })
                    }
                    placeholder="e.g., Customer cancellation, Service issue, Exceptional circumstances, etc."
                    rows={2}
                    required={adminOverride}
                  />
                  {adminOverride && (
                    <p className="text-sm text-amber-700 mt-1">
                      Required when using admin override
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">Admin Notes {adminOverride && <span className="text-red-600">*</span>}</Label>
                  <Textarea
                    id="notes"
                    value={refundForm.notes}
                    onChange={(e) =>
                      setRefundForm({ ...refundForm, notes: e.target.value })
                    }
                    placeholder={adminOverride ? "REQUIRED: Explain why policy override is justified" : "Internal notes about this refund"}
                    rows={2}
                    required={adminOverride}
                  />
                  {adminOverride && (
                    <p className="text-sm text-amber-700 mt-1">
                      Required when using admin override - explain the justification
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsRefundDialogOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button onClick={handleRefund} disabled={processing}>
                  {processing ? "Processing..." : "Process Refund"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {refundCalculation.remainingRefundable <= 0 && maxRefundableWithOverride <= 0 && (!breakdown || breakdown.fullRefundAvailable <= 0) && (
          <div className="text-sm text-gray-500">
            No remaining refundable amount. Total refunded: $
            {refundCalculation.alreadyRefunded.toFixed(2)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
