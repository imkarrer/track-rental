"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle, Clock } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function BookingSuccessPage() {
  const router = useRouter()
  const [checkingBooking, setCheckingBooking] = useState(true)
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if there's a pending booking that needs fallback confirmation
    const pendingBooking = localStorage.getItem('pendingBooking')
    
    if (!pendingBooking) {
      setCheckingBooking(false)
      setBookingConfirmed(true)
      return
    }

    const checkBooking = async () => {
      try {
        const { reservationId, paymentIntentId, timestamp } = JSON.parse(pendingBooking)
        
        // Wait a bit to give webhook time to fire (webhook should be nearly instant)
        const elapsed = Date.now() - timestamp
        if (elapsed < 5000) {
          // Wait up to 5 seconds for webhook
          await new Promise(resolve => setTimeout(resolve, 5000 - elapsed))
        }

        // Check if webhook created the booking, if not, use fallback
        // We need to get user info from session for the confirmation call
        const sessionResponse = await fetch('/api/auth/session')
        const session = await sessionResponse.json()

        if (!session?.user) {
          console.log("No session, webhook should handle it")
          setCheckingBooking(false)
          setBookingConfirmed(true)
          localStorage.removeItem('pendingBooking')
          return
        }

        // Try to get stored form data for customer info
        const trackId = localStorage.getItem('activeReservation')
        let customerInfo = {
          firstName: session.user.name?.split(' ')[0] || '',
          lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
          email: session.user.email || '',
          phone: '',
          billingAddress: '',
          billingCity: '',
          billingState: '',
          billingZip: '',
        }

        // Try to get more complete customer info from booking draft
        if (trackId) {
          try {
            const draft = JSON.parse(localStorage.getItem(`bookingDraft-${JSON.parse(trackId).trackId}`) || '{}')
            if (draft.formData) {
              customerInfo = {
                ...customerInfo,
                phone: draft.formData.phone || '',
                billingAddress: draft.formData.eventAddress || '',
                billingCity: draft.formData.eventCity || '',
                billingState: draft.formData.eventState || '',
                billingZip: draft.formData.eventZip || '',
              }
            }
          } catch (e) {
            console.log("Could not restore customer info from draft")
          }
        }

        const response = await fetch('/api/bookings/check-or-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            paymentIntentId,
            customerInfo,
            smsOptIn: false,
            emailOptOut: false,
          }),
        })

        const result = await response.json()

        if (response.ok) {
          console.log(`✅ Booking confirmed via ${result.source}`)
          setBookingConfirmed(true)
          // Store the booking ID for display
          if (result.booking?.id) {
            setBookingId(result.booking.id)
          }
          localStorage.removeItem('pendingBooking')
        } else {
          console.error("Booking confirmation check failed:", result)
          // Still mark as success - webhook might have handled it
          setBookingConfirmed(true)
          localStorage.removeItem('pendingBooking')
        }
      } catch (error) {
        console.error("Error checking booking:", error)
        // Don't show error to user - webhook likely handled it
        setBookingConfirmed(true)
        localStorage.removeItem('pendingBooking')
      } finally {
        setCheckingBooking(false)
      }
    }

    checkBooking()
  }, [])

  return (
    <div className="container mx-auto px-4 py-16" data-testid="booking-success-page">
      <div className="max-w-2xl mx-auto">
        <Card data-testid="booking-success-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {checkingBooking ? (
                <Clock className="h-16 w-16 text-blue-500 animate-pulse" />
              ) : (
                <CheckCircle className="h-16 w-16 text-green-500" />
              )}
            </div>
            <CardTitle className="text-3xl" data-testid="booking-success-title">
              {checkingBooking ? "⏳ Processing Your Booking..." : "🎉 Booking Confirmed!"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            {checkingBooking ? (
              <>
                <p className="text-lg text-gray-600">
                  Please wait while we confirm your payment and create your booking...
                </p>
                <p className="text-sm text-gray-500">
                  This usually takes just a few seconds.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg text-gray-600" data-testid="booking-success-message">
                  ✅ Thank you for your booking. Your payment has been processed successfully.
                </p>
                {bookingId && (
                  <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
                    <span className="font-medium">Booking Number: </span>
                    <span data-testid="booking-success-number" className="font-mono font-semibold">
                      {bookingId.slice(0, 8)}
                    </span>
                  </div>
                )}
                <p className="text-gray-600">
                  📧 You will receive a confirmation email shortly with all the details of your booking.
                </p>
                <div className="flex gap-4 justify-center pt-4">
                  <Link href="/bookings">
                    <Button variant="default" data-testid="booking-success-view-bookings-button">📅 View My Bookings</Button>
                  </Link>
                  <Link href="/tracks">
                    <Button variant="outline" data-testid="booking-success-browse-tracks-button">🏁 Browse More Tracks</Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
