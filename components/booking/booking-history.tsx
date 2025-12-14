"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateWithWeekdayUTC } from "@/lib/date/format"

interface HistoryEntry {
  id: string
  actionType: string
  performedBy: string
  performedByRole: string
  oldEventDate?: string
  oldEndDate?: string
  oldTotal?: number
  oldStatus?: string
  newEventDate?: string
  newEndDate?: string
  newTotal?: number
  newStatus?: string
  refundAmount?: number
  paymentAmount?: number
  refundPercent?: number
  reason?: string
  notes?: string
  metadata?: any
  createdAt: string
}

interface HistorySummary {
  totalChanges: number
  modifications: number
  cancellations: number
  totalRefunds: number
  totalPayments: number
}

interface BookingHistoryProps {
  bookingId: string
}

export function BookingHistory({ bookingId }: BookingHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [summary, setSummary] = useState<HistorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])

  useEffect(() => {
    fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/bookings/${bookingId}/history`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch history")
      }

      setHistory(data.history)
      setSummary(data.summary)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history")
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpanded(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "CREATED":
        return "✅"
      case "MODIFIED_DATE":
      case "MODIFIED_CARS":
      case "MODIFIED_BOTH":
        return "✏️"
      case "CANCELLED":
        return "❌"
      case "COMPLETED":
        return "🎉"
      case "PAYMENT_RECEIVED":
        return "💳"
      case "REFUND_ISSUED":
        return "💰"
      default:
        return "📝"
    }
  }

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case "CREATED":
        return "bg-green-100 text-green-800 border-green-200"
      case "MODIFIED_DATE":
      case "MODIFIED_CARS":
      case "MODIFIED_BOTH":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200"
      case "COMPLETED":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "PAYMENT_RECEIVED":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "REFUND_ISSUED":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatActionType = (actionType: string) => {
    return actionType
      .split("_")
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ")
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Loading history...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">⚠️ {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No history available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking History</CardTitle>
        {summary && (
          <div className="text-sm text-gray-600 mt-2">
            <div className="flex flex-wrap gap-4">
              <span>Total Changes: <strong>{summary.totalChanges}</strong></span>
              {summary.modifications > 0 && (
                <span>Modifications: <strong>{summary.modifications}</strong></span>
              )}
              {summary.totalRefunds != null && summary.totalRefunds > 0 && (
                <span>Total Refunds: <strong>${summary.totalRefunds.toFixed(2)}</strong></span>
              )}
              {summary.totalPayments != null && summary.totalPayments > 0 && (
                <span>Additional Payments: <strong>${summary.totalPayments.toFixed(2)}</strong></span>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => {
            const isExpanded = expanded.includes(entry.id)
            const isLastItem = index === history.length - 1

            return (
              <div
                key={entry.id}
                className={`border rounded-lg p-4 ${getActionColor(entry.actionType)}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getActionIcon(entry.actionType)}</span>
                    <div>
                      <div className="font-semibold">
                        {formatActionType(entry.actionType)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {entry.performedByRole}
                  </Badge>
                </div>

                {/* Summary info */}
                <div className="space-y-2 text-sm">
                  {/* Date changes */}
                  {entry.oldEventDate && entry.newEventDate && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-600">From:</span>{" "}
                        <span className="font-medium">
                          {formatDateWithWeekdayUTC(entry.oldEventDate)}
                          {entry.oldEndDate && entry.oldEndDate !== entry.oldEventDate && 
                            ` - ${formatDateWithWeekdayUTC(entry.oldEndDate)}`
                          }
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">To:</span>{" "}
                        <span className="font-medium">
                          {formatDateWithWeekdayUTC(entry.newEventDate)}
                          {entry.newEndDate && entry.newEndDate !== entry.newEventDate && 
                            ` - ${formatDateWithWeekdayUTC(entry.newEndDate)}`
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Initial booking info */}
                  {entry.actionType === "CREATED" && entry.newEventDate && (
                    <div>
                      <span className="text-gray-600">Date:</span>{" "}
                      <span className="font-medium">
                        {formatDateWithWeekdayUTC(entry.newEventDate)}
                        {entry.newEndDate && entry.newEndDate !== entry.newEventDate && 
                          ` - ${formatDateWithWeekdayUTC(entry.newEndDate)}`
                        }
                      </span>
                    </div>
                  )}

                  {/* Total changes */}
                  {entry.oldTotal != null && entry.newTotal != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Price:</span>
                      <span className="line-through text-gray-500">
                        ${entry.oldTotal.toFixed(2)}
                      </span>
                      <span>→</span>
                      <span className="font-semibold">
                        ${entry.newTotal.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Initial booking total */}
                  {entry.actionType === "CREATED" && entry.newTotal != null && (
                    <div>
                      <span className="text-gray-600">Total:</span>{" "}
                      <span className="font-semibold">
                        ${entry.newTotal.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Financial info */}
                  {entry.refundAmount != null && entry.refundAmount > 0 && (
                    <div className="flex items-center gap-2 text-green-700">
                      <span>💰 Refund:</span>
                      <span className="font-semibold">
                        ${entry.refundAmount.toFixed(2)}
                      </span>
                      {entry.refundPercent != null && (
                        <span className="text-xs">
                          ({entry.refundPercent}% of original)
                        </span>
                      )}
                    </div>
                  )}

                  {entry.paymentAmount != null && entry.paymentAmount > 0 && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <span>💳 Additional Payment:</span>
                      <span className="font-semibold">
                        ${entry.paymentAmount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Reason */}
                  {entry.reason && (
                    <div className="text-xs text-gray-600 italic">
                      {entry.reason}
                    </div>
                  )}

                  {/* Expand/collapse details */}
                  {entry.metadata && (
                    <button
                      onClick={() => toggleExpanded(entry.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>
                  )}

                  {/* Expanded metadata */}
                  {isExpanded && entry.metadata && (
                    <div className="mt-2 p-2 bg-white bg-opacity-50 rounded border text-xs">
                      <div className="font-semibold mb-1">Additional Details:</div>
                      {entry.metadata.wasMultiDay !== undefined && (
                        <div>
                          Was Multi-day: {entry.metadata.wasMultiDay ? "Yes" : "No"}
                        </div>
                      )}
                      {entry.metadata.willBeMultiDay !== undefined && (
                        <div>
                          Will be Multi-day: {entry.metadata.willBeMultiDay ? "Yes" : "No"}
                        </div>
                      )}
                      {entry.metadata.oldDays && (
                        <div>Original Duration: {entry.metadata.oldDays} day(s)</div>
                      )}
                      {entry.metadata.newDays && (
                        <div>New Duration: {entry.metadata.newDays} day(s)</div>
                      )}
                      {entry.metadata.oldAdditionalCarsCount !== undefined && (
                        <div>
                          Old Additional Cars: {entry.metadata.oldAdditionalCarsCount}
                        </div>
                      )}
                      {entry.metadata.newAdditionalCarsCount !== undefined && (
                        <div>
                          New Additional Cars: {entry.metadata.newAdditionalCarsCount}
                        </div>
                      )}
                      {entry.metadata.promoCodePreserved && (
                        <div className="text-green-700 font-medium">
                          ✓ Promo code preserved
                        </div>
                      )}
                      {entry.metadata.calculation && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="font-semibold mb-1">Calculation:</div>
                          <div>Action: {entry.metadata.calculation.action}</div>
                          {entry.metadata.calculation.creditAmount != null && entry.metadata.calculation.creditAmount > 0 && (
                            <div>
                              Credit: ${entry.metadata.calculation.creditAmount.toFixed(2)}
                            </div>
                          )}
                          {entry.metadata.calculation.newChargeAmount != null && entry.metadata.calculation.newChargeAmount > 0 && (
                            <div>
                              New Charge: ${entry.metadata.calculation.newChargeAmount.toFixed(2)}
                            </div>
                          )}
                          {entry.metadata.calculation.netDifference != null && (
                            <div>
                              Net: ${entry.metadata.calculation.netDifference.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Connection line to next item */}
                {!isLastItem && (
                  <div className="flex justify-center mt-4">
                    <div className="w-0.5 h-4 bg-gray-300"></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
