"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDateWithWeekdayUTC } from "@/lib/date/format"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CancelBookingDialog } from "./cancel-dialog"
import { BookingHistory } from "./booking-history"

interface Booking {
  id: string
  trackName: string
  trackId: string
  eventDate: string // YYYY-MM-DD
  endDate: string | null
  total: number
  status: string
  createdAt: string
}

interface UserBookingsListProps {
  bookings: Booking[]
}

export function UserBookingsList({ bookings }: UserBookingsListProps) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)

  const handleActionComplete = () => {
    // Refresh the page to show updated booking
    router.refresh()
    setRefreshKey((prev) => prev + 1)
  }

  const toggleHistory = (bookingId: string) => {
    setExpandedHistory(expandedHistory === bookingId ? null : bookingId)
  }

  // Separate confirmed and non-confirmed bookings
  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED")
  const otherBookings = bookings.filter((b) => b.status !== "CONFIRMED")

  // Check if booking is in the future
  const isFutureBooking = (eventDate: string) => {
    const bookingDate = new Date(eventDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return bookingDate >= today
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {bookings.map((b) => {
        const canReschedule = b.status === "CONFIRMED" && isFutureBooking(b.eventDate)
        const canCancel = b.status === "CONFIRMED" && isFutureBooking(b.eventDate)

        return (
          <Card key={`${b.id}-${refreshKey}`} data-testid={`booking-card-${b.id}`} className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="truncate pr-2">{b.trackName}</span>
                <span
                  data-testid={`booking-status-${b.id}`}
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    b.status === "CONFIRMED"
                      ? "bg-green-100 text-green-700"
                      : b.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-700"
                      : b.status === "CANCELLED"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {b.status.toLowerCase()}
                </span>
              </CardTitle>
              <div className="text-xs text-gray-500 mt-1">
                <span>Booking # </span>
                <span data-testid={`booking-number-${b.id}`} className="font-mono">
                  {b.id.slice(0, 8)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-2 space-y-2">
              <div className="space-y-1 text-sm text-gray-700">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-xs text-gray-500">Event</span>
                  <span className="text-sm">{formatDateWithWeekdayUTC(b.eventDate)}</span>
                </div>
                {b.endDate && (
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-xs text-gray-500">Ends</span>
                    <span className="text-sm">{formatDateWithWeekdayUTC(b.endDate)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1">
                  <span className="font-medium text-xs text-gray-500">Total</span>
                  <span className="text-base font-semibold">${b.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline text-gray-400 text-xs">
                  <span>Booked</span>
                  <span>{formatDateWithWeekdayUTC(b.createdAt)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 border-t space-y-2">
                {(canReschedule || canCancel) && (
                  <div className="flex gap-2">
                    {canReschedule && (
                      <Link href={`/bookings/modify?bookingId=${b.id}`} className="flex-1">
                        <Button data-testid={`booking-modify-button-${b.id}`} variant="outline" size="sm" className="w-full text-xs py-1 h-7">
                          ✏️ Modify
                        </Button>
                      </Link>
                    )}

                    {canCancel && (
                      <div className="flex-1">
                        <CancelBookingDialog
                          bookingId={b.id}
                          trackName={b.trackName}
                          eventDate={b.eventDate}
                          onCancelComplete={handleActionComplete}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {/* View History button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs py-1 h-7"
                  onClick={() => toggleHistory(b.id)}
                >
                  📋 {expandedHistory === b.id ? "Hide" : "View"} History
                </Button>
              </div>

              {/* Expanded history section */}
              {expandedHistory === b.id && (
                <div className="pt-2 border-t">
                  <BookingHistory bookingId={b.id} />
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

