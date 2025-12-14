"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookingDateRangePicker } from "@/components/booking/date-range-picker"
import { CarSelection } from "@/components/booking/car-selection"
import { RefundPolicyDisplay } from "@/components/booking/refund-policy-display"
import { formatDateWithWeekdayUTC } from "@/lib/date/format"
import { CheckoutForm } from "@/components/booking/checkout-form"

interface Car {
  id: string
  name: string
  type: string
  basePricePerDay: number
  stockQuantity: number
  category: string
  imageUrls: string[]
}

interface SelectedCar {
  carId: string
  quantity: number
}

interface BookingCar {
  carId: string
  carName: string
  carType: string
  quantity: number
  isFree: boolean
  unitPrice: number
  totalPrice: number
}

interface Booking {
  id: string
  trackId: string
  trackName: string
  trackCategory: string
  eventDate: string
  endDate: string | null
  basePrice: number
  total: number
  referralCode: string | null
  referralDiscount: number
  status: string
  freeCarsIncluded: number
  additionalCarsCount: number
  additionalCarsPrice: number
  bookingCars: BookingCar[]
}

interface ReschedulePreview {
  oldEventDate: string
  oldEndDate: string | null
  newEventDate: string
  newEndDate: string | null
  oldDays: number
  newDays: number
  oldTotal: number
  newTotal: number
  action: "refund" | "payment" | "none"
  amount: number
  refundPercent: number
  promoCode: string | null
  promoCodePreserved: boolean
  oldAdditionalCarsCount: number
  newAdditionalCarsCount: number
  wasMultiDay: boolean
  willBeMultiDay: boolean
  daysUntilOriginalEvent: number
}

const RESCHEDULE_SESSION_KEY = "rescheduleSession"

type RescheduleSession = {
  bookingId: string
  reservationId: string
  expiresAt: string
  eventDate: string
  endDate?: string
  selectedCars: SelectedCar[]
  preview?: ReschedulePreview
  step?: 1 | 2 | 3
  paymentIntentId?: string | null
}

export default function ReschedulePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const bookingId = searchParams.get("bookingId")

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [formData, setFormData] = useState({
    eventDate: "",
    endDate: "",
  })
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [dateError, setDateError] = useState<string | null>(null)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [reservationExpiresAt, setReservationExpiresAt] = useState<Date | null>(null)
  const [reservationTimeRemaining, setReservationTimeRemaining] = useState<number | null>(null)
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [preview, setPreview] = useState<ReschedulePreview | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [refundPolicies, setRefundPolicies] = useState<any[]>([])
  const [refundPolicyAcknowledged, setRefundPolicyAcknowledged] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const restoredSessionRef = useRef(false)

  const clearStoredSession = useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.removeItem(RESCHEDULE_SESSION_KEY)
  }, [])
  
  // Car selection state
  const [cars, setCars] = useState<Car[]>([])
  const [selectedCars, setSelectedCars] = useState<SelectedCar[]>([])
  const [carsLoading, setCarsLoading] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [status, router])

  // Fetch booking details
  useEffect(() => {
    if (!bookingId || status !== "authenticated") return

    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to load booking")
        }

        setBooking(data)
        setFormData({
          eventDate: data.eventDate,
          endDate: data.endDate || "",
        })
        
        // Initialize selected cars from booking
        if (data.bookingCars && data.bookingCars.length > 0) {
          const initialSelectedCars: SelectedCar[] = data.bookingCars.map((bc: BookingCar) => ({
            carId: bc.carId,
            quantity: bc.quantity,
          }))
          setSelectedCars(initialSelectedCars)
        }
      } catch (error) {
        console.error("Error fetching booking:", error)
        setGlobalError(error instanceof Error ? error.message : "Failed to load booking")
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [bookingId, status])

  // Restore an in-progress reschedule session (sticky checkout)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (restoredSessionRef.current) return
    if (!bookingId || status !== "authenticated") return

    const stored = localStorage.getItem(RESCHEDULE_SESSION_KEY)
    if (!stored) return

    try {
      const sessionData: RescheduleSession = JSON.parse(stored)
      if (sessionData.bookingId !== bookingId) return

      const expiry = new Date(sessionData.expiresAt)
      if (expiry <= new Date()) {
        clearStoredSession()
        return
      }

      fetch(`/api/reservations/${sessionData.reservationId}`)
        .then(async (res) => {
          const data = await res.json().catch(() => ({}))
          return { ok: res.ok, data }
        })
        .then(({ ok, data }) => {
          if (!ok || data?.expired) {
            clearStoredSession()
            return
          }

          setReservationId(sessionData.reservationId)
          setReservationExpiresAt(new Date(sessionData.expiresAt))
          setFormData({
            eventDate: sessionData.eventDate || "",
            endDate: sessionData.endDate || "",
          })
          if (sessionData.selectedCars?.length) {
            setSelectedCars(sessionData.selectedCars)
          }
          if (sessionData.preview) {
            setPreview(sessionData.preview)
          }
          if (sessionData.paymentIntentId) {
            setPaymentIntentId(sessionData.paymentIntentId)
          }
          setStep(sessionData.step ?? 2)
          restoredSessionRef.current = true
        })
        .catch(() => {
          clearStoredSession()
        })
    } catch (error) {
      console.error("Failed to restore reschedule session", error)
      clearStoredSession()
    }
  }, [bookingId, status, clearStoredSession])
  
  // Fetch available cars for the track category
  useEffect(() => {
    if (!booking?.trackCategory) return
    
    const fetchCars = async () => {
      setCarsLoading(true)
      try {
        const response = await fetch(`/api/cars?category=${booking.trackCategory}`)
        const data = await response.json()
        
        if (response.ok) {
          setCars(data.cars || [])
        }
      } catch (error) {
        console.error("Error fetching cars:", error)
      } finally {
        setCarsLoading(false)
      }
    }
    
    fetchCars()
  }, [booking?.trackCategory])

  // Helper to parse date string to Date object
  const parseDateOnly = useCallback((value: string | undefined | null): Date | undefined => {
    if (!value) return undefined
    const [y, m, d] = value.split("-").map(Number)
    if (!y || !m || !d) return undefined
    return new Date(y, m - 1, d)
  }, [])

  // Calculate default month for calendar (show booking's month)
  const defaultMonth = useMemo(() => {
    if (!booking?.eventDate) return undefined
    const bookingDate = parseDateOnly(booking.eventDate)
    if (!bookingDate) return undefined
    // Return first day of the month to ensure calendar shows correct month
    return new Date(bookingDate.getFullYear(), bookingDate.getMonth(), 1)
  }, [booking?.eventDate, parseDateOnly])

  // Check if a date is unavailable
  const isUnavailableDate = useCallback((value: string): boolean => {
    return unavailableDates.includes(value)
  }, [unavailableDates])

  // Validate date range
  const validateDateRange = useCallback((startDate: string, endDate: string) => {
    if (!startDate) {
      setDateError("Please select a date")
      return false
    }

    // Check if start date is unavailable
    if (isUnavailableDate(startDate)) {
      setDateError(`The date ${startDate} is unavailable. Please pick another date.`)
      return false
    }

    // If there's an end date, validate it too
    if (endDate && endDate !== startDate) {
      if (isUnavailableDate(endDate)) {
        setDateError(`The date ${endDate} is unavailable. Please pick another date.`)
        return false
      }

      // Check if any dates in the range are unavailable
      const start = parseDateOnly(startDate)
      const end = parseDateOnly(endDate)
      if (start && end) {
        const unavailableInRange = unavailableDates.filter(date => {
          const checkDate = parseDateOnly(date)
          return checkDate && checkDate >= start && checkDate <= end
        })
        if (unavailableInRange.length > 0) {
          setDateError(`The selected date range includes unavailable dates: ${unavailableInRange.slice(0, 3).join(", ")}${unavailableInRange.length > 3 ? "..." : ""}`)
          return false
        }
      }
    }

    setDateError(null)
    return true
  }, [unavailableDates, isUnavailableDate, parseDateOnly])

  // Fetch unavailable dates
  useEffect(() => {
    if (!booking?.trackId || status !== "authenticated" || !session?.user?.id) return

    const fetchUnavailableDates = async () => {
      try {
        const response = await fetch(
          `/api/tracks/${booking.trackId}/availability?excludeBookingId=${bookingId}&excludeUserId=${session.user.id}&excludeReservationId=${reservationId || ""}`
        )
        const data = await response.json()
        
        if (response.ok) {
          const unavailable = data.unavailableDates || []
          // Add past dates to unavailable
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const pastDates: string[] = []
          
          // Generate past dates for the last 365 days
          for (let i = 1; i <= 365; i++) {
            const pastDate = new Date(today)
            pastDate.setDate(pastDate.getDate() - i)
            const dateStr = pastDate.toISOString().split('T')[0]
            pastDates.push(dateStr)
          }
          
          setUnavailableDates([...unavailable, ...pastDates])
        }
      } catch (error) {
        console.error("Error fetching availability:", error)
      }
    }

    fetchUnavailableDates()
  }, [booking?.trackId, bookingId, status, session?.user?.id, reservationId])

  // Validate dates when they change
  useEffect(() => {
    if (formData.eventDate) {
      validateDateRange(formData.eventDate, formData.endDate)
    }
  }, [formData.eventDate, formData.endDate, validateDateRange])

  // Fetch refund policies
  useEffect(() => {
    if (!booking?.trackId) return

    const fetchRefundPolicies = async () => {
      try {
        const response = await fetch(`/api/tracks/${booking.trackId}/refund-policies`)
        const data = await response.json()
        
        if (response.ok) {
          setRefundPolicies(data.policies || [])
        }
      } catch (error) {
        console.error("Error fetching refund policies:", error)
      }
    }

    fetchRefundPolicies()
  }, [booking?.trackId])

  // Reservation timer
  useEffect(() => {
    if (!reservationExpiresAt) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, reservationExpiresAt.getTime() - now)
      setReservationTimeRemaining(remaining)

      if (remaining === 0) {
        setReservationId(null)
        setReservationExpiresAt(null)
        setGlobalError("Your reservation has expired. Please select a new date.")
        clearStoredSession()
        setStep(1)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [reservationExpiresAt, clearStoredSession])

  // Persist the current reschedule checkout session so it survives navigation
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!reservationId || !reservationExpiresAt || !bookingId) return

    const sessionData: RescheduleSession = {
      bookingId,
      reservationId,
      expiresAt: reservationExpiresAt.toISOString(),
      eventDate: formData.eventDate,
      endDate: formData.endDate || "",
      selectedCars,
      preview: preview || undefined,
      step,
      paymentIntentId,
    }

    localStorage.setItem(RESCHEDULE_SESSION_KEY, JSON.stringify(sessionData))
  }, [
    reservationId,
    reservationExpiresAt,
    bookingId,
    formData.eventDate,
    formData.endDate,
    selectedCars,
    preview,
    step,
    paymentIntentId,
  ])

  const handleCreateReservation = async () => {
    if (!booking || !formData.eventDate) {
      setGlobalError("Please select a new date")
      return
    }

    if (dateError) {
      setGlobalError(dateError)
      return
    }
    
    if (selectedCars.length === 0) {
      setGlobalError("Please select at least one car")
      return
    }

    // Validate minimum 2 cars per track
    const totalCarQuantity = selectedCars.reduce((sum, c) => sum + c.quantity, 0)
    if (totalCarQuantity < 2) {
      setGlobalError("A minimum of 2 cars is required per track.")
      return
    }

    // Prevent no-op reschedule: must change date OR change additional cars
    const sameStart = booking.eventDate === formData.eventDate
    const sameEnd =
      (booking.endDate || "") === (formData.endDate || "")

    const calcAdditionalCars = (cars: SelectedCar[], freeCarsIncluded: number) => {
      const total = cars.reduce((sum, c) => sum + c.quantity, 0)
      return Math.max(0, total - freeCarsIncluded)
    }
    const newAdditionalCarsCount = calcAdditionalCars(selectedCars, booking.freeCarsIncluded ?? 2)
    const sameAdditionalCars = newAdditionalCarsCount === booking.additionalCarsCount

    if (sameStart && sameEnd && sameAdditionalCars) {
      setGlobalError("Please change the date or adjust additional cars before continuing.")
      return
    }

    setIsCreatingReservation(true)
    setGlobalError(null)

    try {
      // First, calculate the preview with new car selection
      const previewResponse = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          newEventDate: formData.eventDate,
          newEndDate: formData.endDate || undefined,
          selectedCars: selectedCars,
        }),
      })

      const previewData = await previewResponse.json()

      if (!previewResponse.ok) {
        throw new Error(previewData.error || "Failed to calculate reschedule")
      }

      setPreview(previewData)

      // Check if date is changing
      const dateIsChanging = !sameStart || !sameEnd

      // Only create reservation if date is changing
      // If date is NOT changing, the booking already has that date reserved
      if (dateIsChanging) {
        const reservationResponse = await fetch("/api/reservations/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.id,
            trackId: booking.trackId,
            newEventDate: formData.eventDate,
            newEndDate: formData.endDate || undefined,
          }),
        })

        const reservationData = await reservationResponse.json()

        if (!reservationResponse.ok) {
          throw new Error(reservationData.error || "Failed to create reservation")
        }

        setReservationId(reservationData.reservationId)
        setReservationExpiresAt(new Date(reservationData.expiresAt))
      } else {
        // Date not changing - no reservation needed
        setReservationId(null)
        setReservationExpiresAt(null)
      }

      setStep(2)
    } catch (error) {
      console.error("Error creating reservation:", error)
      setGlobalError(error instanceof Error ? error.message : "Failed to create reservation")
    } finally {
      setIsCreatingReservation(false)
    }
  }

  const handleConfirmReschedule = async (paymentIntentIdParam?: string) => {
    if (!preview) return

    setConfirming(true)
    setGlobalError(null)

    try {
      // Use parameter if provided, otherwise use state
      const intentId = paymentIntentIdParam || paymentIntentId

      // If payment is required, we need paymentIntentId
      if (preview.action === "payment" && !intentId) {
        throw new Error("Payment required but not completed")
      }

      const response = await fetch("/api/bookings/reschedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking!.id,
          newEventDate: formData.eventDate,
          newEndDate: formData.endDate || undefined,
          reservationId: reservationId || undefined, // Optional - only needed if date changed
          paymentIntentId: intentId || undefined,
          selectedCars: selectedCars,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reschedule booking")
      }

      // Success! Redirect to bookings page
      clearStoredSession()
      router.push("/bookings?rescheduleSuccess=true")
    } catch (error) {
      console.error("Error confirming reschedule:", error)
      setGlobalError(error instanceof Error ? error.message : "Failed to confirm reschedule")
    } finally {
      setConfirming(false)
    }
  }

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-red-600">Booking not found</p>
            <div className="text-center mt-4">
              <Button onClick={() => router.push("/bookings")}>
                Back to Bookings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (booking.status !== "CONFIRMED") {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-red-600">
              Only confirmed bookings can be rescheduled
            </p>
            <div className="text-center mt-4">
              <Button onClick={() => router.push("/bookings")}>
                Back to Bookings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Global error banner */}
      {globalError && (
        <div className="fixed top-4 right-4 z-50">
          <Card className="bg-red-50 border-red-200 text-red-800 shadow-lg">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <p className="font-semibold">{globalError}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setGlobalError(null)}>
                ×
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <span>✏️</span>
          Modify Booking
        </h1>
        <p className="text-gray-600">
          Change your booking date and/or car selection for {booking.trackName}
        </p>
      </div>

      {/* Current booking info */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>Current Booking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Track</p>
              <p className="font-semibold">{booking.trackName}</p>
            </div>
            <div>
              <p className="text-gray-600">Current Date</p>
              <p className="font-semibold">
                {formatDateWithWeekdayUTC(booking.eventDate)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Current Total</p>
              <p className="font-semibold">${booking.total.toFixed(2)}</p>
            </div>
            {booking.referralCode && (
              <div>
                <p className="text-gray-600">Promo Code</p>
                <p className="font-semibold text-green-600">{booking.referralCode}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Select New Date and Cars */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Modify Booking</CardTitle>
              <CardDescription>
                Update your booking date and/or car selection. Unavailable dates are crossed out.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <BookingDateRangePicker
                  label="Booking Date(s)"
                  startValue={formData.eventDate}
                  endValue={formData.endDate}
                  onChange={(start, end) => {
                    setFormData({ eventDate: start, endDate: end })
                    // Validation will happen in useEffect
                  }}
                  disabledDates={unavailableDates}
                  minDate={new Date().toISOString().split('T')[0]}
                  defaultMonth={defaultMonth}
                  required
                />

                {dateError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 text-lg">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">Invalid Date Selection</p>
                        <p className="text-sm text-red-700 mt-1">{dateError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Car Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Cars</CardTitle>
              <CardDescription>
                Modify your car selection if needed. First 2 cars are free.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {carsLoading ? (
                <p className="text-center text-gray-600">Loading cars...</p>
              ) : (
                <CarSelection
                  cars={cars}
                  selectedCars={selectedCars}
                  onChange={setSelectedCars}
                />
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleCreateReservation}
            disabled={!formData.eventDate || !!dateError || isCreatingReservation || selectedCars.length === 0}
            className="w-full"
            size="lg"
          >
            {isCreatingReservation
              ? "Processing..."
              : dateError
              ? "Please Fix Date Selection"
              : selectedCars.length === 0
              ? "Please Select At Least One Car"
              : !formData.eventDate
              ? "Please Select a Date"
              : "Review Modification"}
          </Button>
          
          {(dateError || !formData.eventDate) && (
            <p className="text-sm text-gray-600 text-center">
              {dateError 
                ? "Select a valid available date to continue"
                : "Choose a new date for your booking above"}
            </p>
          )}
        </div>
      )}

      {/* Step 2: Review Changes */}
      {step === 2 && preview && (
        <div className="space-y-6">
          {/* Reservation timer - only show if date is changing */}
          {reservationTimeRemaining !== null && reservationId && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="py-3">
                <p className="text-sm text-center">
                  ⏱️ New date reserved for{" "}
                  <strong>{formatTimeRemaining(reservationTimeRemaining)}</strong>
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Date not changing notice */}
          {!reservationId && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-3">
                <p className="text-sm text-center">
                  📌 Modifying cars for your existing booking date - no reservation needed
                </p>
              </CardContent>
            </Card>
          )}

          {/* Price comparison */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle>Step 2: Review Modification</CardTitle>
              <CardDescription>
                Review the changes to your booking and pricing before confirming
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Current Date{preview.wasMultiDay ? 's' : ''}</p>
                  <p className="font-semibold">
                    {formatDateWithWeekdayUTC(preview.oldEventDate)}
                    {preview.oldEndDate && preview.oldEndDate !== preview.oldEventDate && (
                      <> → {formatDateWithWeekdayUTC(preview.oldEndDate)}</>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {preview.oldDays} day{preview.oldDays > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm text-gray-600">New Date{preview.willBeMultiDay ? 's' : ''}</p>
                  <p className="font-semibold">
                    {formatDateWithWeekdayUTC(preview.newEventDate)}
                    {preview.newEndDate && preview.newEndDate !== preview.newEventDate && (
                      <> → {formatDateWithWeekdayUTC(preview.newEndDate)}</>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {preview.newDays} day{preview.newDays > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Duration change notice */}
              {preview.oldDays !== preview.newDays && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800">
                    {preview.newDays > preview.oldDays ? (
                      <>📅 Adding {preview.newDays - preview.oldDays} day{preview.newDays - preview.oldDays > 1 ? 's' : ''} to your booking</>
                    ) : (
                      <>📅 Removing {preview.oldDays - preview.newDays} day{preview.oldDays - preview.newDays > 1 ? 's' : ''} from your booking</>
                    )}
                  </p>
                </div>
              )}

              {/* Price comparison */}
              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span>Current Total:</span>
                  <span className="line-through">${preview.oldTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>New Total:</span>
                  <span className="font-bold">${preview.newTotal.toFixed(2)}</span>
                </div>

                {/* Action display */}
                {preview.action === "refund" && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                    <p className="font-semibold text-green-800 text-lg">
                      💰 Refund: ${preview.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Based on {preview.refundPercent}% refund policy
                    </p>
                    <p className="text-xs text-green-600 mt-2">
                      Refund will be processed automatically to your original payment method
                    </p>
                  </div>
                )}

                {preview.action === "payment" && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded">
                    <p className="font-semibold text-orange-800 text-lg">
                      💳 Additional Payment: ${preview.amount.toFixed(2)}
                    </p>
                    <div className="text-sm text-orange-700 mt-2 space-y-1">
                      <p>Change summary:</p>
                      <ul className="list-disc list-inside text-orange-800">
                        <li>Track/day change: ${preview.breakdown?.deltas?.trackPrice?.toFixed?.(2) ?? "0.00"}</li>
                        <li>Cars change: ${preview.breakdown?.deltas?.additionalCarsPrice?.toFixed?.(2) ?? "0.00"}</li>
                        <li>Tax change: ${preview.breakdown?.deltas?.tax?.toFixed?.(2) ?? "0.00"}</li>
                      </ul>
                      <p className="text-xs text-orange-600">
                        Total difference (after promo): ${preview.breakdown?.deltas?.totalWithPromo?.toFixed?.(2) ?? preview.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {preview.action === "none" && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded">
                    <p className="font-semibold text-gray-800">
                      ✓ No price change
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Same day rate, no refund or payment needed
                    </p>
                  </div>
                )}
              </div>

              {/* Car changes removed per request */}

              {/* Promo code preservation */}
              {preview.promoCodePreserved && (
                <div className="border-t pt-4">
                  <p className="text-sm text-green-700">
                    ✅ Promo code <strong>{preview.promoCode}</strong> will be preserved
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Refund policy - show for both refunds and payments */}
          {(preview.action === "refund" || preview.action === "payment") && refundPolicies.length > 0 && (
            <RefundPolicyDisplay policies={refundPolicies} compact />
          )}

          {/* Confirmation */}
          <Card>
            <CardHeader>
              <CardTitle>Confirm Modification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Back to dates
                </Button>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="refundPolicy"
                  checked={refundPolicyAcknowledged}
                  onChange={(e) => setRefundPolicyAcknowledged(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="refundPolicy" className="text-sm">
                  I understand the pricing changes and {(preview.action === "refund" || preview.action === "payment") ? "refund policy" : "terms"}
                </label>
              </div>

              {/* Payment form for upgrades */}
              {preview.action === "payment" && refundPolicyAcknowledged && reservationId && (
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-3">
                    Complete payment to confirm booking modification
                  </p>
                  <CheckoutForm
                    reservationId={reservationId}
                    total={preview.amount}
                    onSuccess={(paymentIntentIdFromStripe) => {
                      // Payment successful, capture the payment intent ID and confirm the reschedule
                      if (paymentIntentIdFromStripe) {
                        setPaymentIntentId(paymentIntentIdFromStripe)
                      }
                      handleConfirmReschedule(paymentIntentIdFromStripe)
                    }}
                    onError={(error) => {
                      setGlobalError(error)
                    }}
                    hideContactInfo={true}
                  />
                </div>
              )}

              {/* Confirm button for refunds/no change */}
              {preview.action !== "payment" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(1)
                      setPreview(null)
                      setReservationId(null)
                      setReservationExpiresAt(null)
                    }}
                    disabled={confirming}
                    className="flex-1"
                  >
                    Change Date
                  </Button>
                  <Button
                    onClick={handleConfirmReschedule}
                    disabled={!refundPolicyAcknowledged || confirming}
                    className="flex-1"
                  >
                    {confirming ? "Processing..." : "Confirm Modification"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

