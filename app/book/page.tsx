"use client"

import { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CarSelection } from "@/components/booking/car-selection"
import { PriceBreakdown } from "@/components/booking/price-breakdown"
import { CompactDayPricing } from "@/components/booking/compact-day-pricing"
import { CheckoutForm } from "@/components/booking/checkout-form"
import { RefundPolicyDisplay } from "@/components/booking/refund-policy-display"
import { calculatePricing, calculateDurationHours } from "@/lib/pricing/calculate"
import { calculateDistance } from "@/lib/distance/calculate"
import { validateTrackFitsInSpace } from "@/lib/validation/space"
import Image from "next/image"
import { BookingDateRangePicker } from "@/components/booking/date-range-picker"

interface Track {
  id: string
  name: string
  description?: string | null
  category: string
  length: number
  width: number
  minSpaceLength: number
  minSpaceWidth: number
  basePrice: number
  setupTimeMinutes: number
  imageUrls: string[]
  includedCarIds?: string[]
}

interface Car {
  id: string
  name: string
  type: string
  basePricePerDay: number
  stockQuantity: number
  category: string
  imageUrls: string[]
  isActive?: boolean
}

interface SelectedCar {
  carId: string
  quantity: number
}

function BookPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const trackId = searchParams.get("trackId")

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [refundPolicies, setRefundPolicies] = useState<any[]>([])
  const [refundPolicyAcknowledged, setRefundPolicyAcknowledged] = useState(false)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [track, setTrack] = useState<Track | null>(null)
  const [cars, setCars] = useState<Car[]>([])
  const [selectedCars, setSelectedCars] = useState<SelectedCar[]>([])
  const [customerInfo, setCustomerInfo] = useState<any>(null)
  const [pricing, setPricing] = useState<any>(null)
  const [spaceValidation, setSpaceValidation] = useState<any>(null)
  const [additionalCarsPrice, setAdditionalCarsPrice] = useState(0)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [reservationExpiresAt, setReservationExpiresAt] = useState<Date | null>(null)
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [dateError, setDateError] = useState<string | null>(null)
  const [reservationTimeRemaining, setReservationTimeRemaining] = useState<number | null>(null)
  const [paymentSucceeded, setPaymentSucceeded] = useState(false)
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null)
  const [rewards, setRewards] = useState<Array<{ id: string; amount: number; status: string }>>([])
  const [promoCode, setPromoCode] = useState("")
  const [promoCodeValidating, setPromoCodeValidating] = useState(false)
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null)
  const [promoCodeDiscount, setPromoCodeDiscount] = useState<number | null>(null)
  const [discountedTotal, setDiscountedTotal] = useState<number | null>(null)
  const [restoredReservation, setRestoredReservation] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const restoredDraftRef = useRef(false)

  // Form data
  const [formData, setFormData] = useState({
    eventDate: "",
    endDate: "", // For multi-day bookings
    startTime: "09:00",
    endTime: "17:00",
    eventAddress: "",
    eventCity: "",
    eventState: "",
    eventZip: "",
    availableSpaceLength: "",
    availableSpaceWidth: "",
    phone: "",
    smsOptIn: false,
  })

// Parse a YYYY-MM-DD into a local Date (avoids timezone shifts)
const parseDateOnly = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const BOOKING_DRAFT_KEY = "bookingDraft"

  const fetchRefundPolicies = async () => {
    try {
      const response = await fetch("/api/refund-policies/public")
      if (response.ok) {
        const data = await response.json()
        setRefundPolicies(data.policies || [])
      }
    } catch (error) {
      console.error("Error fetching refund policies:", error)
    }
  }

  const fetchUnavailableDates = useCallback(async () => {
    if (!trackId) return
    try {
      const params = new URLSearchParams()
      params.set("excludeUserId", session?.user?.id || "")
      params.set("excludeReservationId", reservationId || "")
      const response = await fetch(`/api/tracks/${trackId}/availability?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setUnavailableDates(data.unavailableDates || [])
      }
    } catch (error) {
      console.error("Error fetching unavailable dates:", error)
    }
  }, [trackId, session?.user?.id, reservationId])

  // Function to cancel/cleanup reservation
  const cancelReservation = useCallback(async (id: string) => {
    try {
      // Use sendBeacon for reliable cleanup during page unload
      const url = `/api/reservations/${id}`
      const blob = new Blob([JSON.stringify({})], { type: 'application/json' })
      
      // Try sendBeacon first (works during unload)
      if (typeof navigator.sendBeacon === "function") {
        // sendBeacon doesn't support DELETE, so we'll use fetch with keepalive
        await fetch(url, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => {
          // Fallback: use sendBeacon to at least log the attempt
          console.log("Reservation cleanup attempted via beacon")
        })
      } else {
        // Fallback for browsers without sendBeacon
        await fetch(url, {
          method: 'DELETE',
        })
      }
    } catch (error) {
      console.error("Error canceling reservation:", error)
    }
  }, [])

  const fetchTrackAndCars = useCallback(async () => {
    try {
      const [trackRes, carsRes] = await Promise.all([
        fetch(`/api/tracks/${trackId}`),
        fetch("/api/cars"),
      ])

      const trackData = await trackRes.json()
      const carsData = await carsRes.json()

      setTrack(trackData.track)
      // Filter cars to match track category
          const matchingCars = (carsData.cars || []).filter(
            (car: Car) => car.category === trackData.track.category && car.isActive && car.stockQuantity > 0
          )
      setCars(matchingCars)

      // Auto-select default cars included with track using the track's includedCarIds
      const defaultSelectedCars: SelectedCar[] = []
      if (trackData.track.includedCarIds && trackData.track.includedCarIds.length > 0) {
        // Use the track's specified default cars
        trackData.track.includedCarIds.forEach((carId: string) => {
          // Only include if the car is in matchingCars (active and has stock)
          if (matchingCars.some((car: Car) => car.id === carId)) {
            defaultSelectedCars.push({
              carId,
              quantity: 1,
            })
          }
        })
      } else {
        // Fallback: use first 2 matching cars if no includedCarIds specified
        matchingCars.slice(0, 2).forEach((car: Car) => {
          defaultSelectedCars.push({
            carId: car.id,
            quantity: 1,
          })
        })
      }
      
      // Load selected cars from localStorage if available (overrides defaults)
      const saved = localStorage.getItem(`track-${trackId}-cars`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          const includedCars = parsed.includedCars || []
          const additionalCars = parsed.additionalCars || {}

          // Build selectedCars array
          const selectedCarsArray: SelectedCar[] = []
          
          // Add included cars
          includedCars.forEach((carId: string) => {
            const car = matchingCars.find((c: Car) => c.id === carId)
            if (car) {
              selectedCarsArray.push({
                carId,
                quantity: 1,
              })
            }
          })

          // Add additional cars
          Object.entries(additionalCars as Record<string, number>).forEach(([carId, quantity]) => {
            const car = matchingCars.find((c: Car) => c.id === carId)
            if (car && Number(quantity) > 0) {
              selectedCarsArray.push({
                carId,
                quantity: Number(quantity),
              })
            }
          })

          if (selectedCarsArray.length > 0) {
            setSelectedCars(selectedCarsArray)
          } else {
            // No saved selection, use defaults
            setSelectedCars(defaultSelectedCars)
          }
        } catch (e) {
          console.error("Error loading saved car selection:", e)
          // On error, use defaults
          setSelectedCars(defaultSelectedCars)
        }
      } else {
        // No saved selection, use defaults
        setSelectedCars(defaultSelectedCars)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }, [trackId])

  // Persist draft so entered info survives navigation
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!trackId) return
    const draft = {
      formData,
      selectedCars,
      customerInfo,
      step,
      reservationId,
      reservationExpiresAt: reservationExpiresAt?.toISOString() || null,
    }
    localStorage.setItem(`${BOOKING_DRAFT_KEY}-${trackId}`, JSON.stringify(draft))
  }, [trackId, formData, selectedCars, customerInfo, step, reservationId, reservationExpiresAt])

  // Restore draft (entered info) so user returns where they left off
  useEffect(() => {
    if (typeof window === "undefined") return
    if (restoredDraftRef.current) return
    if (!trackId) return

    const saved = localStorage.getItem(`${BOOKING_DRAFT_KEY}-${trackId}`)
    if (!saved) return
    try {
      const draft = JSON.parse(saved)
      if (draft.formData) setFormData((prev) => ({ ...prev, ...draft.formData }))
      if (draft.selectedCars) setSelectedCars(draft.selectedCars)
      if (draft.customerInfo) setCustomerInfo(draft.customerInfo)
      if (draft.step) setStep(draft.step)
      if (draft.reservationId) setReservationId(draft.reservationId)
      if (draft.reservationExpiresAt) setReservationExpiresAt(new Date(draft.reservationExpiresAt))
    } catch (e) {
      console.error("Failed to restore booking draft", e)
    }
    restoredDraftRef.current = true
  }, [trackId])

  // Check for existing active reservation on mount
  useEffect(() => {
    if (trackId && status === "authenticated") {
      const stored = localStorage.getItem('activeReservation')
      if (stored) {
        try {
          const { reservationId: storedId, expiresAt: storedExpiry, trackId: storedTrackId, eventDate: storedEventDate, endDate: storedEndDate, startTime: storedStartTime, endTime: storedEndTime } = JSON.parse(stored)
          const expiryDate = new Date(storedExpiry)
          
          // Check if reservation is for this track and hasn't expired
          if (storedTrackId === trackId && expiryDate > new Date()) {
            // Verify reservation still exists on server
            fetch(`/api/reservations/${storedId}`)
              .then(res => res.json())
              .then(data => {
                if (data.reservation && !data.expired) {
                  // Restore reservation state
                  setReservationId(data.reservation.id)
                  setReservationExpiresAt(new Date(data.reservation.expiresAt))
                  setRestoredReservation(true)
                  console.log("Restored existing reservation:", data.reservation.id)
                  
                  // Restore date/time selection from reservation so calendar highlights it
                  if (data.reservation.eventDate) {
                    const eventDateStr = storedEventDate || new Date(data.reservation.eventDate).toISOString().split("T")[0]
                    const endDateStr = storedEndDate || (data.reservation.endDate
                      ? new Date(data.reservation.endDate).toISOString().split("T")[0]
                      : "")
                    setFormData((prev) => ({
                      ...prev,
                      eventDate: eventDateStr,
                      endDate: endDateStr,
                      startTime: storedStartTime || data.reservation.startTime || prev.startTime,
                      endTime: storedEndTime || data.reservation.endTime || prev.endTime,
                      eventAddress: prev.eventAddress || data.reservation.eventAddress || "",
                      eventCity: prev.eventCity || data.reservation.eventCity || "",
                      eventState: prev.eventState || data.reservation.eventState || "",
                      eventZip: prev.eventZip || data.reservation.eventZip || "",
                      availableSpaceLength: prev.availableSpaceLength || data.reservation.availableSpaceLength?.toString?.() || "",
                      availableSpaceWidth: prev.availableSpaceWidth || data.reservation.availableSpaceWidth?.toString?.() || "",
                    }))
                  }

                  // Restore car selection if present
                  if (data.reservation.selectedCars && data.reservation.selectedCars.length > 0) {
                    setSelectedCars(data.reservation.selectedCars)
                    setStep(2)
                  }
                } else {
                  // Reservation no longer valid, clear localStorage
                  localStorage.removeItem('activeReservation')
                }
              })
              .catch(() => {
                // Error checking reservation, clear localStorage
                localStorage.removeItem('activeReservation')
              })
          } else if (expiryDate <= new Date()) {
            // Expired reservation, clear localStorage
            localStorage.removeItem('activeReservation')
          }
        } catch (e) {
          console.error("Error restoring reservation:", e)
          localStorage.removeItem('activeReservation')
        }
      }
    }
  }, [trackId, status])

  useEffect(() => {
    // Check authentication
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/book?trackId=" + trackId)
      return
    }

    if (trackId && status === "authenticated") {
      fetchTrackAndCars()
      fetchRefundPolicies()
      fetchUnavailableDates()
      fetch("/api/rewards")
        .then((res) => res.json())
        .then((data) => {
          setRewards((data.rewards || []).filter((r: any) => r.status === "AWARDED"))
        })
        .catch(() => {})
    } else if (!trackId) {
      router.push("/tracks")
    }
  }, [trackId, status, router, fetchUnavailableDates, fetchTrackAndCars])


  // Recalculate pricing when address changes (debounced)
  const addressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pricingCalculatedRef = useRef(false)
  
  // Track when pricing is first calculated
  useEffect(() => {
    if (pricing) {
      pricingCalculatedRef.current = true
    }
  }, [pricing])
  
  useEffect(() => {
    // Only recalculate if pricing has already been calculated
    if (!pricingCalculatedRef.current || !track || selectedCars.length === 0 || !formData.eventDate) {
      return
    }

    // Check if address fields are complete
    if (!formData.eventAddress || !formData.eventCity || !formData.eventState || !formData.eventZip) {
      return
    }

    // Clear existing timeout
    if (addressTimeoutRef.current) {
      clearTimeout(addressTimeoutRef.current)
    }

    // Debounce the recalculation
    addressTimeoutRef.current = setTimeout(async () => {
      try {
        // Calculate new distance
        const newDistanceResult = await calculateDistance(
          formData.eventAddress,
          formData.eventCity,
          formData.eventState,
          formData.eventZip
        )

        // Recalculate pricing with new distance
        const eventDateObj = parseDateOnly(formData.eventDate)
        const endDateObj = formData.endDate ? parseDateOnly(formData.endDate) : null
        const isMultiDay = endDateObj && endDateObj > eventDateObj

        if (isMultiDay) {
          // Multi-day recalculation
          const carsWithPrices = selectedCars
            .map((selected) => {
              const car = cars.find((c) => c.id === selected.carId)
              return car
                ? {
                    carId: selected.carId,
                    basePricePerDay: Number(car.basePricePerDay),
                    quantity: selected.quantity,
                  }
                : null
            })
            .filter((c): c is NonNullable<typeof c> => c !== null)

          const pricingResponse = await fetch("/api/pricing/multi-day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trackBasePrice: Number(track.basePrice),
              startDate: formData.eventDate,
              endDate: formData.endDate,
              startTime: formData.startTime,
              endTime: formData.endTime,
              setupTimeMinutes: track.setupTimeMinutes,
              distanceFromBase: newDistanceResult.distanceMiles,
              selectedCars: carsWithPrices,
            }),
          })

          if (pricingResponse.ok) {
            const pricingResult = await pricingResponse.json()
            setPricing({
              ...pricingResult,
              distanceResult: newDistanceResult,
              validation: spaceValidation,
              isMultiDay: true,
            })
          }
        } else {
          // Single day recalculation
          const holidayCheckResponse = await fetch(
            `/api/holidays/check?date=${formData.eventDate}`
          )
          
          if (!holidayCheckResponse.ok) {
            console.error("Holiday check failed during address update")
            return
          }
          
          const holidayCheck = await holidayCheckResponse.json()

          // Track multiplier source for UI
          let dayMultiplier: number
          let dayMultiplierSource = "day-of-week"
          let holidayName: string | null = null
          if (holidayCheck.isHoliday && holidayCheck.holidayMultiplier) {
            dayMultiplier = holidayCheck.holidayMultiplier
            dayMultiplierSource = "holiday-smart"
            holidayName = holidayCheck.holidayName || null
          } else {
            dayMultiplier = holidayCheck.effectiveMultiplier || 1.0
          }

          const dayName = eventDateObj.toLocaleDateString("en-US", { weekday: "long" })

          const carsWithPrices = selectedCars
            .map((selected) => {
              const car = cars.find((c) => c.id === selected.carId)
              return car
                ? {
                    carId: selected.carId,
                    basePricePerDay: Number(car.basePricePerDay),
                    quantity: selected.quantity,
                  }
                : null
            })
            .filter((c): c is NonNullable<typeof c> => c !== null)

          const pricingResult = calculatePricing({
            trackBasePrice: Number(track.basePrice),
            eventDate: eventDateObj,
            startTime: formData.startTime,
            endTime: formData.endTime,
            setupTimeMinutes: track.setupTimeMinutes,
            distanceFromBase: newDistanceResult.distanceMiles,
            selectedCars: carsWithPrices,
            dayMultiplier,
          })

          setPricing({
            ...pricingResult,
            dayMultiplierSource,
            holidayName,
            dayName,
            distanceResult: newDistanceResult,
            validation: spaceValidation,
            isMultiDay: false,
          })
        }
      } catch (error) {
        console.error("Error recalculating price after address change:", error)
        // Don't show alert, just log - user can manually recalculate
      }
    }, 1000) // 1 second debounce

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (addressTimeoutRef.current) {
        clearTimeout(addressTimeoutRef.current)
      }
    }
  }, [
    formData.eventAddress,
    formData.eventCity,
    formData.eventState,
    formData.eventZip,
    formData.eventDate,
    formData.endDate,
    formData.startTime,
    formData.endTime,
    track,
    selectedCars,
    spaceValidation,
    cars,
  ])

  // Refresh unavailable dates periodically (every 5 seconds) to catch expired reservations and prevent race conditions
  useEffect(() => {
    if (!trackId) return
    
    const interval = setInterval(() => {
      fetchUnavailableDates()
    }, 5000) // Refresh every 5 seconds for better race condition handling

    return () => clearInterval(interval)
  }, [trackId, fetchUnavailableDates])

  // Refresh unavailable dates when returning to Step 1
  useEffect(() => {
    if (step === 1 && trackId) {
      fetchUnavailableDates()
    }
  }, [step, trackId, fetchUnavailableDates])

  // Improved cleanup: Only cancel reservation in specific scenarios
  useEffect(() => {
    if (!reservationId) return

    // Don't cleanup if payment has succeeded
    if (paymentSucceeded) {
      console.log("Payment succeeded, not cleaning up reservation")
      // Clear localStorage since booking is complete
      localStorage.removeItem('activeReservation')
      return
    }

    // Track if payment is in progress
    const isPaymentStage = step === 3
    
    // Don't cleanup if user is actively confirming payment
    if (isPaymentStage && paymentConfirmed) {
      console.log("Payment confirmation in progress, not cleaning up reservation")
      return
    }

    // Only show warning on beforeunload, but DON'T cancel reservation
    // This allows users to navigate away and come back
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Show warning to user (browser will show generic message)
      if (step !== 1) {
        e.preventDefault()
        e.returnValue = '' // Chrome requires returnValue to be set
      }
      // NOTE: We intentionally DO NOT cancel the reservation here
      // It will persist in localStorage and can be restored
    }

    // Handle visibility change (tab switch, minimize)
    // Only cancel if user is gone for an extended period
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Page hidden, reservation will be cleaned up if user doesn't return within 5 minutes")
        // Increased timeout to 5 minutes (was 2) for better UX
        const timeoutId = setTimeout(() => {
          if (document.hidden && reservationId && !paymentSucceeded) {
            console.log("User hasn't returned after 5 minutes, canceling reservation")
            cancelReservation(reservationId)
            localStorage.removeItem('activeReservation')
          }
        }, 300000) // 5 minutes

        // Clear timeout if user returns
        const handleVisible = () => {
          if (!document.hidden) {
            console.log("User returned, keeping reservation active")
            clearTimeout(timeoutId)
            document.removeEventListener('visibilitychange', handleVisible)
          }
        }
        document.addEventListener('visibilitychange', handleVisible)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [reservationId, cancelReservation, step, paymentConfirmed, paymentSucceeded])

  // Update reservation timer every second
  useEffect(() => {
    if (!reservationExpiresAt) return

    const updateTimer = () => {
      const now = Date.now()
      const expiresAt = reservationExpiresAt.getTime()
      const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setReservationTimeRemaining(remainingSeconds)

      // If expired, show error and go back to step 1
      if (remainingSeconds === 0 && reservationId) {
        setErrorMessage("Your reservation has expired. Please start over.")
        localStorage.removeItem('activeReservation')
        setReservationId(null)
        setReservationExpiresAt(null)
        setStep(1)
      }
    }

    // Update immediately
    updateTimer()

    // Update every second
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [reservationExpiresAt, reservationId])

  // Calculate preliminary pricing when dates are entered (without address)
  const datePricingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    // Only calculate if we have dates and track, but don't require address
    if (!track || !formData.eventDate || !formData.startTime || !formData.endTime) {
      return
    }

    // Don't calculate if dates are unavailable
    if (dateError) {
      return
    }

    // Clear existing timeout
    if (datePricingTimeoutRef.current) {
      clearTimeout(datePricingTimeoutRef.current)
    }

    // Debounce the calculation
    datePricingTimeoutRef.current = setTimeout(async () => {
      try {
        const eventDateObj = parseDateOnly(formData.eventDate)
        const endDateObj = formData.endDate ? parseDateOnly(formData.endDate) : null
        const isMultiDay = endDateObj && endDateObj > eventDateObj

        // Get selected cars (use saved cars from localStorage or default included cars)
        let carsToUse = selectedCars
        if (carsToUse.length === 0 && track.includedCarIds && track.includedCarIds.length >= 2) {
          // Use included cars as default (first 2)
          carsToUse = track.includedCarIds.slice(0, 2).map(carId => ({
            carId,
            quantity: 1
          }))
        }

        if (carsToUse.length === 0) {
          return // Can't calculate without cars
        }

        const carsWithPrices = carsToUse
          .map((selected) => {
            const car = cars.find((c) => c.id === selected.carId)
            return car
              ? {
                  carId: selected.carId,
                  basePricePerDay: Number(car.basePricePerDay),
                  quantity: selected.quantity,
                }
              : null
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)

        if (isMultiDay) {
          // Multi-day preliminary pricing (distance = 0)
          const pricingResponse = await fetch("/api/pricing/multi-day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trackBasePrice: Number(track.basePrice),
              startDate: formData.eventDate,
              endDate: formData.endDate,
              startTime: formData.startTime,
              endTime: formData.endTime,
              setupTimeMinutes: track.setupTimeMinutes,
              distanceFromBase: 0, // No distance surcharge until address is entered
              selectedCars: carsWithPrices,
            }),
          })

          if (pricingResponse.ok) {
            const pricingResult = await pricingResponse.json()
            setPricing({
              ...pricingResult,
              distanceResult: { distanceMiles: 0, durationMinutes: 0 },
              validation: spaceValidation,
              isMultiDay: true,
            })
          }
        } else {
          // Single day preliminary pricing (distance = 0)
          const holidayCheckResponse = await fetch(
            `/api/holidays/check?date=${formData.eventDate}`
          )
          
          if (!holidayCheckResponse.ok) {
            return
          }
          
          const holidayCheck = await holidayCheckResponse.json()

          let dayMultiplier: number
          let dayMultiplierSource = "day-of-week"
          let holidayName: string | null = null
          if (holidayCheck.isHoliday && holidayCheck.holidayMultiplier) {
            dayMultiplier = holidayCheck.holidayMultiplier
            dayMultiplierSource = "holiday-smart"
            holidayName = holidayCheck.holidayName || null
          } else {
            dayMultiplier = holidayCheck.effectiveMultiplier || 1.0
          }
          const dayName = eventDateObj.toLocaleDateString("en-US", { weekday: "long" })

          const pricingResult = calculatePricing({
            trackBasePrice: Number(track.basePrice),
            eventDate: eventDateObj,
            startTime: formData.startTime,
            endTime: formData.endTime,
            setupTimeMinutes: track.setupTimeMinutes,
            distanceFromBase: 0, // No distance surcharge until address is entered
            selectedCars: carsWithPrices,
            dayMultiplier,
          })

          setPricing({
            ...pricingResult,
            dayMultiplierSource,
            holidayName,
            dayName,
            distanceResult: { distanceMiles: 0, durationMinutes: 0 },
            validation: spaceValidation,
            isMultiDay: false,
          })
        }
      } catch (error) {
        console.error("Error calculating preliminary pricing:", error)
      }
    }, 500) // 500ms debounce for date changes

    // Cleanup timeout
    return () => {
      if (datePricingTimeoutRef.current) {
        clearTimeout(datePricingTimeoutRef.current)
      }
    }
  }, [
    formData.eventDate,
    formData.endDate,
    formData.startTime,
    formData.endTime,
    track,
    selectedCars,
    cars,
    spaceValidation,
    dateError,
  ])

  const isUnavailableDate = useCallback(
    (value: string) => unavailableDates.includes(value),
    [unavailableDates]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setDateError(null) // Clear previous date errors

    // Check if selected date(s) are unavailable
    if (name === "eventDate" || name === "endDate") {
      const selectedDate = value
      if (selectedDate && isUnavailableDate(selectedDate)) {
        // Prevent selection of unavailable date
        setDateError(`The date ${selectedDate} is unavailable. Please pick another date.`)
        setFormData((prev) => ({ ...prev, [name]: "" }))
        return
      }

      // Check if date range includes unavailable dates
      if (name === "eventDate" && formData.endDate) {
        const start = parseDateOnly(value)
        const end = parseDateOnly(formData.endDate)
        const unavailableInRange = unavailableDates.filter(date => {
          const checkDate = parseDateOnly(date)
          return checkDate >= start && checkDate <= end
        })
        if (unavailableInRange.length > 0) {
          setDateError(`The selected date range includes unavailable dates: ${unavailableInRange.join(", ")}`)
          return
        }
      }

      if (name === "endDate" && formData.eventDate) {
        const start = parseDateOnly(formData.eventDate)
        const end = parseDateOnly(value)
        const unavailableInRange = unavailableDates.filter(date => {
          const checkDate = parseDateOnly(date)
          return checkDate >= start && checkDate <= end
        })
        if (unavailableInRange.length > 0) {
          setDateError(`The selected date range includes unavailable dates: ${unavailableInRange.join(", ")}`)
          return
        }
      }
    }

    // Update additional cars price when date changes (for preview)
    if (name === "eventDate" && track && selectedCars.length > 0) {
      const carsWithPrices = selectedCars
        .map((selected) => {
          const car = cars.find((c) => c.id === selected.carId)
          return car
            ? {
                carId: selected.carId,
                basePricePerDay: Number(car.basePricePerDay),
                quantity: selected.quantity,
              }
            : null
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)

      const totalCarQuantity = carsWithPrices.reduce((sum, car) => sum + car.quantity, 0)
      const freeCarsIncluded = 2
      let calculatedAdditionalCarsPrice = 0
      let remainingFree = freeCarsIncluded

      for (const car of carsWithPrices) {
        for (let i = 0; i < car.quantity; i++) {
          if (remainingFree > 0) {
            remainingFree--
          } else {
            calculatedAdditionalCarsPrice += car.basePricePerDay
          }
        }
      }
      setAdditionalCarsPrice(calculatedAdditionalCarsPrice)
    }

    // Validate space when dimensions are entered
    if (
      (name === "availableSpaceLength" || name === "availableSpaceWidth") &&
      track &&
      formData.availableSpaceLength &&
      formData.availableSpaceWidth
    ) {
      const validation = validateTrackFitsInSpace(
        Number(track.length),
        Number(track.width),
        Number(name === "availableSpaceLength" ? value : formData.availableSpaceLength),
        Number(name === "availableSpaceWidth" ? value : formData.availableSpaceWidth)
      )
      setSpaceValidation(validation)
    }
  }

  const handleCalculatePrice = async () => {
    if (!track) return

    setErrorMessage(null)
    setCalculating(true)

    try {
      // Validate required fields
      if (
        !formData.eventDate ||
        !formData.startTime ||
        !formData.endTime ||
        !formData.eventAddress ||
        !formData.eventCity ||
        !formData.eventState ||
        !formData.eventZip
      ) {
        setErrorMessage("Please fill in all required fields")
        return
      }

      // Validate space
      if (!formData.availableSpaceLength || !formData.availableSpaceWidth) {
        setErrorMessage("Please enter available space dimensions")
        return
      }

      const validation = validateTrackFitsInSpace(
        Number(track.length),
        Number(track.width),
        Number(formData.availableSpaceLength),
        Number(formData.availableSpaceWidth)
      )

      if (!validation.fits) {
        setErrorMessage(validation.message)
        return
      }

      // Calculate distance
      const distanceResult = await calculateDistance(
        formData.eventAddress,
        formData.eventCity,
        formData.eventState,
        formData.eventZip
      )

      // Get selected cars with their base prices
      const carsWithPrices = selectedCars
        .map((selected) => {
          const car = cars.find((c) => c.id === selected.carId)
          return car
            ? {
                carId: selected.carId,
                basePricePerDay: Number(car.basePricePerDay),
                quantity: selected.quantity,
              }
            : null
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)

      // Parse dates as local (avoid timezone shift)
      const parseDateOnly = (dateStr: string) => {
        const [y, m, d] = dateStr.split("-").map(Number)
        return new Date(y, m - 1, d)
      }

      // Calculate pricing - handle multi-day bookings
      const eventDateObj = parseDateOnly(formData.eventDate)
      const endDateObj = formData.endDate ? parseDateOnly(formData.endDate) : null
      
      // Check if it's a multi-day booking
      const isMultiDay = endDateObj && endDateObj > eventDateObj
      
      let pricingResult: any
      
      // For multi-day, calculate pricing for each day
      if (isMultiDay) {
        // Call API for multi-day pricing
        const pricingResponse = await fetch("/api/pricing/multi-day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackBasePrice: Number(track.basePrice),
            startDate: formData.eventDate,
            endDate: formData.endDate,
            startTime: formData.startTime,
            endTime: formData.endTime,
            setupTimeMinutes: track.setupTimeMinutes,
            distanceFromBase: distanceResult.distanceMiles,
            selectedCars: carsWithPrices,
          }),
        })

        if (!pricingResponse.ok) {
          const errorText = await pricingResponse.text()
          throw new Error(`Failed to calculate multi-day pricing: ${pricingResponse.status} ${errorText}`)
        }

        pricingResult = await pricingResponse.json()
      } else {
        // Single day booking
        const dayOfWeek = eventDateObj.getDay()
        
        // Check if it's a holiday first
        const holidayCheckResponse = await fetch(
          `/api/holidays/check?date=${formData.eventDate}`
        )
        
        if (!holidayCheckResponse.ok) {
          const errorText = await holidayCheckResponse.text()
          throw new Error(`Holiday check failed: ${holidayCheckResponse.status} ${errorText}`)
        }
        
        const holidayCheck = await holidayCheckResponse.json()
        
        // Debug logging
        console.log("Holiday check for date:", formData.eventDate, holidayCheck)
        
        // Use holiday multiplier if it's a holiday, otherwise use day-of-week multiplier
        // Track the source for UI display
        let dayMultiplier: number
        let dayMultiplierSource = "day-of-week"
        let holidayName: string | null = null
        if (holidayCheck.isHoliday && holidayCheck.holidayMultiplier) {
          dayMultiplier = holidayCheck.holidayMultiplier
          dayMultiplierSource = "holiday-smart"
          holidayName = holidayCheck.holidayName || null
          console.log("Using HOLIDAY multiplier:", dayMultiplier, "for holiday:", holidayCheck.holidayName)
        } else {
          dayMultiplier = holidayCheck.effectiveMultiplier || 1.0
          console.log("Using day-of-week multiplier:", dayMultiplier)
        }
        const dayName = eventDateObj.toLocaleDateString("en-US", { weekday: "long" })
        
        pricingResult = calculatePricing({
          trackBasePrice: Number(track.basePrice),
          eventDate: eventDateObj,
          startTime: formData.startTime,
          endTime: formData.endTime,
          setupTimeMinutes: track.setupTimeMinutes,
          distanceFromBase: distanceResult.distanceMiles,
          selectedCars: carsWithPrices,
          dayMultiplier, // Use holiday-aware multiplier
        })

        // Attach source for UI display
        pricingResult.dayMultiplierSource = dayMultiplierSource
        pricingResult.holidayName = holidayName
        pricingResult.dayName = dayName
      }
      
      // Calculate additional cars price for preview
      const totalCarQuantity = carsWithPrices.reduce((sum, car) => sum + car.quantity, 0)
      const freeCarsIncluded = 2
      const additionalCarsCount = Math.max(0, totalCarQuantity - freeCarsIncluded)
      let calculatedAdditionalCarsPrice = 0
      let remainingFree = freeCarsIncluded
      
      for (const car of carsWithPrices) {
        for (let i = 0; i < car.quantity; i++) {
          if (remainingFree > 0) {
            remainingFree--
          } else {
            calculatedAdditionalCarsPrice += car.basePricePerDay
          }
        }
      }
      setAdditionalCarsPrice(calculatedAdditionalCarsPrice)

      setPricing({
        ...pricingResult,
        dayMultiplierSource: pricingResult.dayMultiplierSource ?? undefined,
        holidayName: pricingResult.holidayName ?? null,
        dayName: pricingResult.dayName ?? undefined,
        distanceResult,
        validation,
        isMultiDay,
      })

      // Create reservation (10-minute hold) before moving to car selection step
      setIsCreatingReservation(true)

      try {
        const carsToReserve = selectedCars.length > 0 ? selectedCars : []
        
        const reservationResponse = await fetch("/api/reservations/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackId: track.id,
            eventDate: formData.eventDate,
            endDate: formData.endDate && formData.endDate.trim() !== "" ? formData.endDate : null,
            startTime: formData.startTime,
            endTime: formData.endTime,
            eventAddress: formData.eventAddress,
            eventCity: formData.eventCity,
            eventState: formData.eventState,
            eventZip: formData.eventZip,
            availableSpaceLength: Number(formData.availableSpaceLength),
            availableSpaceWidth: Number(formData.availableSpaceWidth),
            selectedCars: carsToReserve,
            pricing: {
              basePrice: Number(pricingResult.basePrice) || 0,
              dayMultiplier: Number(pricingResult.dayMultiplier) || 1,
              durationMultiplier: Number(pricingResult.durationMultiplier) || 1,
              distanceSurcharge: Number(pricingResult.distanceSurcharge) || 0,
              setupFee: Number(pricingResult.setupFee) || 0,
              freeCarsIncluded: Number(pricingResult.freeCarsIncluded) || 2,
              additionalCarsCount: Number(pricingResult.additionalCarsCount) || 0,
              additionalCarsPrice: Number(pricingResult.additionalCarsPrice) || 0,
              subtotal: Number(pricingResult.subtotal) || 0,
              tax: Number(pricingResult.tax) || 0,
              total: Number(pricingResult.total) || 0,
              dayOfWeek: Number(pricingResult.dayOfWeek) || 0,
              durationHours: Number(pricingResult.durationHours) || 0,
              distanceFromBase: pricingResult.distanceFromBase != null ? Number(pricingResult.distanceFromBase) : null,
            },
          }),
        })

        if (!reservationResponse.ok) {
          let errorMessage = "Failed to create reservation"
          try {
            const error = await reservationResponse.json()
            errorMessage = error.error || errorMessage
            if (error.reservedUntil) {
              errorMessage += ` The date is reserved until ${new Date(error.reservedUntil).toLocaleTimeString()}.`
            }
          } catch (e) {
            const errorText = await reservationResponse.text()
            errorMessage = errorText || errorMessage
          }
          console.error("Reservation API error:", reservationResponse.status, errorMessage)
          throw new Error(errorMessage)
        }

        const { reservation } = await reservationResponse.json()
        setReservationId(reservation.id)
        setReservationExpiresAt(new Date(reservation.expiresAt))
        
        // Store reservation in localStorage for persistence across navigation
        localStorage.setItem('activeReservation', JSON.stringify({
          reservationId: reservation.id,
          expiresAt: reservation.expiresAt,
          trackId: track.id,
          eventDate: formData.eventDate,
          endDate: formData.endDate || "",
          startTime: formData.startTime,
          endTime: formData.endTime,
        }))
        
        setStep(2) // Move to car selection step
      } catch (error) {
        console.error("Error creating reservation:", error)
        // Refresh unavailable dates to show updated conflicts
        await fetchUnavailableDates()
        setErrorMessage(error instanceof Error ? error.message : "Failed to create reservation")
      } finally {
        setIsCreatingReservation(false)
      }
    } catch (error) {
      console.error("Error calculating price:", error)
      setErrorMessage("Error calculating price. Please try again.")
    } finally {
      setCalculating(false)
    }
  }

  const handleCarSelectionChange = async (newSelectedCars: SelectedCar[]) => {
    setSelectedCars(newSelectedCars)
    
    // Calculate additional cars price for preview
    const carsWithPrices = newSelectedCars
      .map((selected) => {
        const car = cars.find((c) => c.id === selected.carId)
        return car
          ? {
              carId: selected.carId,
              basePricePerDay: Number(car.basePricePerDay),
              quantity: selected.quantity,
            }
          : null
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    const totalCarQuantity = carsWithPrices.reduce((sum, car) => sum + car.quantity, 0)
    const freeCarsIncluded = 2
    let calculatedAdditionalCarsPrice = 0
    let remainingFree = freeCarsIncluded
    
    for (const car of carsWithPrices) {
      for (let i = 0; i < car.quantity; i++) {
        if (remainingFree > 0) {
          remainingFree--
        } else {
          calculatedAdditionalCarsPrice += car.basePricePerDay
        }
      }
    }
    setAdditionalCarsPrice(calculatedAdditionalCarsPrice)
    
    // Recalculate pricing if it exists
    if (pricing && track) {
      const eventDateObj = parseDateOnly(formData.eventDate)
      
      // Check if it's a holiday first
      const holidayCheckResponse = await fetch(
        `/api/holidays/check?date=${formData.eventDate}`
      )
      const holidayCheck = await holidayCheckResponse.json()
      
      // Debug logging
      console.log("Holiday check for date (car change):", formData.eventDate, holidayCheck)
      
      // Use holiday multiplier if it's a holiday, otherwise use day-of-week multiplier
      let dayMultiplier: number
      let dayMultiplierSource = "day-of-week"
      let holidayName: string | null = null
      if (holidayCheck.isHoliday && holidayCheck.holidayMultiplier) {
        dayMultiplier = holidayCheck.holidayMultiplier
        dayMultiplierSource = "holiday-smart"
        holidayName = holidayCheck.holidayName || null
        console.log("Using HOLIDAY multiplier (car change):", dayMultiplier, "for holiday:", holidayCheck.holidayName)
      } else {
        dayMultiplier = holidayCheck.effectiveMultiplier || 1.0
        console.log("Using day-of-week multiplier (car change):", dayMultiplier)
      }
      const dayName = eventDateObj.toLocaleDateString("en-US", { weekday: "long" })
      
      const newPricing = calculatePricing({
        trackBasePrice: Number(track.basePrice),
        eventDate: eventDateObj,
        startTime: formData.startTime,
        endTime: formData.endTime,
        setupTimeMinutes: track.setupTimeMinutes,
        distanceFromBase: pricing.distanceResult.distanceMiles,
        selectedCars: carsWithPrices,
        dayMultiplier, // Use holiday-aware multiplier
      })

      setPricing({
        ...newPricing,
        dayMultiplierSource,
        holidayName,
        dayName,
        distanceResult: pricing.distanceResult,
        validation: pricing.validation,
        isMultiDay: false, // Ensure isMultiDay is set
      })
    }
  }

  const handleProceedToCheckout = async () => {
    setErrorMessage(null)
    
    if (selectedCars.length === 0) {
      setErrorMessage("Please select at least one car")
      return
    }

    if (!track || !pricing) {
      setErrorMessage("Please calculate pricing first")
      return
    }

    // Validate required fields
    if (!formData.eventDate || !formData.eventAddress || !formData.eventCity || 
        !formData.eventState || !formData.eventZip || !formData.availableSpaceLength || 
        !formData.availableSpaceWidth) {
      setErrorMessage("Please fill in all required event details")
      return
    }

    if (!reservationId) {
      setErrorMessage("Reservation not found. Please start over.")
      return
    }

    // Update reservation with selected cars
    setIsCreatingReservation(true)

    try {
      const updateResponse = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCars: selectedCars,
          pricing: {
            basePrice: Number(pricing.basePrice) || 0,
            dayMultiplier: Number(pricing.dayMultiplier) || 1,
            durationMultiplier: Number(pricing.durationMultiplier) || 1,
            distanceSurcharge: Number(pricing.distanceSurcharge) || 0,
            setupFee: Number(pricing.setupFee) || 0,
            freeCarsIncluded: Number(pricing.freeCarsIncluded) || 2,
            additionalCarsCount: Number(pricing.additionalCarsCount) || 0,
            additionalCarsPrice: Number(pricing.additionalCarsPrice) || 0,
            subtotal: Number(pricing.subtotal) || 0,
            tax: Number(pricing.tax) || 0,
            total: Number(pricing.total) || 0,
            dayOfWeek: Number(pricing.dayOfWeek) || 0,
            durationHours: Number(pricing.durationHours) || 0,
            distanceFromBase: pricing.distanceFromBase != null ? Number(pricing.distanceFromBase) : null,
          },
        }),
      })

      if (!updateResponse.ok) {
        let errorMessage = "Failed to update reservation"
        try {
          const error = await updateResponse.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          const errorText = await updateResponse.text()
          errorMessage = errorText || errorMessage
        }
        console.error("Reservation update error:", updateResponse.status, errorMessage)
        throw new Error(errorMessage)
      }

      setStep(3)
    } catch (error) {
      console.error("Error updating reservation:", error)
      setErrorMessage(error instanceof Error ? error.message : "Failed to update reservation")
    } finally {
      setIsCreatingReservation(false)
    }
  }


  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="mb-4">Please log in to create a booking.</p>
          <Button onClick={() => router.push("/auth/login?callbackUrl=/book?trackId=" + trackId)}>
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  if (!track) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Track not found</div>
      </div>
    )
  }

  const trackImageUrl = track.imageUrls && track.imageUrls.length > 0 ? track.imageUrls[0] : "/placeholder-track.jpg"

  // Get the default cars for display in the "Included cars" section
  const getDefaultCars = () => {
    if (!track?.includedCarIds || track.includedCarIds.length === 0) {
      // Fallback: show first 2 cars if no includedCarIds specified
      return cars.slice(0, Math.min(2, cars.length))
    }

    // Find cars that match the track's includedCarIds and are active/in stock
    const includedCars = track.includedCarIds
      .map(carId => cars.find(car => car.id === carId))
      .filter(car => car !== undefined)

    return includedCars.slice(0, Math.min(2, includedCars.length))
  }

  const defaultCars = getDefaultCars()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-red-600 text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-sm text-red-800 font-semibold">Error</p>
                <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {restoredReservation && reservationTimeRemaining !== null && reservationTimeRemaining > 0 && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
              <span className="text-lg">✓</span>
              Welcome back! We&apos;ve restored your reservation.
            </p>
            <p className="text-xs text-green-700 mt-1">
              Time remaining: {Math.floor(reservationTimeRemaining / 60)}:{String(reservationTimeRemaining % 60).padStart(2, '0')} minutes
            </p>
          </div>
        )}
        <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
          <span className="text-5xl">📅</span>
          Book Track: {track.name}
        </h1>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          <div className="relative h-32 w-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
            {trackImageUrl.startsWith("http") || trackImageUrl.startsWith("/") ? (
              <Image
                src={trackImageUrl}
                alt={track.name}
                fill
                className="object-contain object-center"
                sizes="192px"
              />
            ) : (
              <span className="text-gray-400">No Image</span>
            )}
          </div>
          <div>
            <p className="text-lg">
              <strong>📏 Dimensions:</strong> {track.length}ft × {track.width}ft
            </p>
            <p className="text-lg">
              <strong>💰 Base Price:</strong> ${Number(track.basePrice).toFixed(2)}
            </p>
          </div>

          {defaultCars.length > 0 && (
            <div className="w-full lg:w-[360px] bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🚗</span>
                <p className="text-sm font-semibold text-gray-800">
                  Included cars with track rental
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {defaultCars.map((car) => {
                  const carImage =
                    car.imageUrls && car.imageUrls.length > 0
                      ? car.imageUrls[0]
                      : "/placeholder-car.jpg"
                  return (
                    <div
                      key={car.id}
                      className="flex gap-3 p-2 rounded border border-gray-200 bg-white"
                    >
                      <div className="relative h-14 w-14 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                        {carImage.startsWith("http") || carImage.startsWith("/") ? (
                          <Image
                            src={carImage}
                            alt={car.name}
                            fill
                            className="object-contain object-center"
                            sizes="56px"
                          />
                        ) : (
                          <span className="text-gray-400 text-[10px]">No Image</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800 leading-tight">
                          {car.name}
                        </p>
                        <p className="text-xs text-gray-600">{car.type}</p>
                        <p className="text-xs text-gray-500">
                          ${Number(car.basePricePerDay).toFixed(2)}/day
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Event Details */}
          {step === 1 && (
            <Card data-testid="booking-step1-event-details">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📋</span>
                  Step 1: Event Details
                </CardTitle>
                <CardDescription>Select your dates and provide event location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Section 1: Date & Time Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <span className="text-lg">📅</span>
                    <h3 className="font-semibold text-base">When is your event?</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <BookingDateRangePicker
                        label="Select Date(s)"
                        startValue={formData.eventDate}
                        endValue={formData.endDate}
                        onChange={(start, end) => {
                          handleInputChange({ target: { name: "eventDate", value: start } } as any)
                          handleInputChange({ target: { name: "endDate", value: end } } as any)
                        }}
                        disabledDates={unavailableDates}
                        minDate={new Date().toISOString().split("T")[0]}
                        required
                        data-testid="booking-date-picker"
                      />
                      {formData.endDate && !dateError && (
                        <p className="text-xs text-gray-500 mt-2">
                          💡 Leave end date blank for single-day bookings
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">
                            Start Time *
                          </label>
                          <Input
                            data-testid="booking-start-time-input"
                            type="time"
                            name="startTime"
                            value={formData.startTime}
                            onChange={handleInputChange}
                            required
                            className="text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">
                            End Time *
                          </label>
                          <Input
                            data-testid="booking-end-time-input"
                            type="time"
                            name="endTime"
                            value={formData.endTime}
                            onChange={handleInputChange}
                            required
                            className="text-base"
                          />
                        </div>
                      </div>

                      {dateError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800 font-semibold mb-1">⚠️ Date Unavailable</p>
                          <p className="text-sm text-red-700">{dateError}</p>
                        </div>
                      )}

                      {track && !dateError && (
                        <CompactDayPricing 
                          trackBasePrice={Number(track.basePrice)}
                          additionalCarsPrice={additionalCarsPrice}
                          selectedDate={formData.eventDate}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Event Location */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <span className="text-lg">📍</span>
                    <h3 className="font-semibold text-base">Where is your event?</h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Event Address *
                      </label>
                      <Input
                        data-testid="booking-event-address-input"
                        type="text"
                        name="eventAddress"
                        value={formData.eventAddress}
                        onChange={handleInputChange}
                        placeholder="123 Main Street"
                        required
                        className="text-base"
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1.5">
                          City *
                        </label>
                        <Input
                          data-testid="booking-event-city-input"
                          type="text"
                          name="eventCity"
                          value={formData.eventCity}
                          onChange={handleInputChange}
                          required
                          className="text-base"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm font-medium mb-1.5">
                          State *
                        </label>
                        <Input
                          data-testid="booking-event-state-input"
                          type="text"
                          name="eventState"
                          value={formData.eventState}
                          onChange={handleInputChange}
                          maxLength={2}
                          placeholder="CA"
                          required
                          className="text-base uppercase"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1.5">
                          ZIP Code *
                        </label>
                        <Input
                          data-testid="booking-event-zip-input"
                          type="text"
                          name="eventZip"
                          value={formData.eventZip}
                          onChange={handleInputChange}
                          required
                          className="text-base"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Space Dimensions */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <span className="text-lg">📐</span>
                    <h3 className="font-semibold text-base">Available Space</h3>
                    <span className="text-xs text-gray-500 ml-auto">
                      Track size: {track.length}ft × {track.width}ft
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Length (ft) *
                      </label>
                      <Input
                        data-testid="booking-space-length-input"
                        type="number"
                        name="availableSpaceLength"
                        value={formData.availableSpaceLength}
                        onChange={handleInputChange}
                        step="0.1"
                        placeholder={`Min: ${track.minSpaceLength}`}
                        required
                        className="text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Width (ft) *
                      </label>
                      <Input
                        data-testid="booking-space-width-input"
                        type="number"
                        name="availableSpaceWidth"
                        value={formData.availableSpaceWidth}
                        onChange={handleInputChange}
                        step="0.1"
                        placeholder={`Min: ${track.minSpaceWidth}`}
                        required
                        className="text-base"
                      />
                    </div>
                  </div>

                  {spaceValidation && (
                    <div
                      className={`p-3 rounded-lg border ${
                        spaceValidation.fits
                          ? "bg-green-50 text-green-800 border-green-200"
                          : "bg-red-50 text-red-800 border-red-200"
                      }`}
                    >
                      <p className="text-sm font-medium">
                        {spaceValidation.fits ? "✓" : "⚠️"} {spaceValidation.message}
                      </p>
                    </div>
                  )}
                </div>

                {/* Section 4: SMS Updates (Collapsible/Optional) */}
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer list-none pb-2 border-b border-gray-200 hover:text-blue-600 transition-colors">
                    <span className="text-lg">📱</span>
                    <h3 className="font-semibold text-base">SMS Updates (Optional)</h3>
                    <span className="text-xs text-gray-500 ml-auto group-open:hidden">Click to expand</span>
                    <span className="text-xs text-gray-500 ml-auto hidden group-open:inline">Click to collapse</span>
                  </summary>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Mobile Phone
                      </label>
                      <Input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="555-123-4567"
                        className="text-base"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        For SMS updates about your booking
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="smsOptIn"
                        checked={formData.smsOptIn}
                        onChange={(e) =>
                          handleInputChange({
                            target: { name: "smsOptIn", value: e.target.checked },
                          } as any)
                        }
                        className="h-4 w-4"
                      />
                      <label htmlFor="smsOptIn" className="text-sm text-gray-700">
                        Send me SMS updates (standard rates apply)
                      </label>
                    </div>
                  </div>
                </details>

                {/* Primary CTA */}
                <div className="pt-4 border-t border-gray-200">
                  <Button
                    data-testid="booking-reserve-dates-button"
                    onClick={handleCalculatePrice}
                    disabled={calculating || !!dateError || isCreatingReservation}
                    className="w-full"
                    size="lg"
                  >
                    {calculating || isCreatingReservation
                      ? "Processing..."
                      : dateError
                      ? "Please Select Available Dates"
                      : "Reserve Dates & Continue →"}
                  </Button>
                  {!dateError && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                      Your dates will be held for 10 minutes while you complete booking
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Car Selection */}
          {step === 2 && (
            <Card data-testid="booking-step2-car-selection">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🏎️</span>
                  Step 2: Select Cars
                </CardTitle>
                <CardDescription>
                  First 2 cars are included FREE with track rental
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reservationTimeRemaining !== null && reservationTimeRemaining > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 font-semibold">
                      ⏰ Your reservation expires in {Math.floor(reservationTimeRemaining / 60)}:{String(reservationTimeRemaining % 60).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Complete your booking before the timer runs out
                    </p>
                  </div>
                )}
                <CarSelection
                  cars={cars}
                  selectedCars={selectedCars}
                  onChange={handleCarSelectionChange}
                />
                <div className="mt-6 flex gap-4">
                  <Button
                    data-testid="booking-step2-back-button"
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    data-testid="booking-proceed-checkout-button"
                    onClick={handleProceedToCheckout}
                    className="flex-1"
                    size="lg"
                    disabled={isCreatingReservation}
                  >
                    {isCreatingReservation ? "Reserving Dates..." : "Proceed to Checkout"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Payment Confirmation */}
          {step === 3 && pricing && reservationId && (
            <Card data-testid="booking-step3-payment">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">💳</span>
                  Step 3: Payment
                </CardTitle>
                <CardDescription>Complete your payment</CardDescription>
              </CardHeader>
              <CardContent>
                {isCreatingReservation ? (
                  <div className="text-center py-8">
                    <p>Updating reservation...</p>
                  </div>
                ) : (
                  <>
                    {reservationTimeRemaining !== null && reservationTimeRemaining > 0 && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 font-semibold">
                          ⏰ Your reservation expires in {Math.floor(reservationTimeRemaining / 60)}:{String(reservationTimeRemaining % 60).padStart(2, '0')}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Complete your payment before the timer runs out
                        </p>
                      </div>
                    )}
                    <div className="mb-6">
                      <RefundPolicyDisplay policies={refundPolicies} compact />
                    </div>
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 font-semibold mb-2">
                        Important: Refund Policy Reminder
                      </p>
                      <p className="text-sm text-yellow-700">
                        By proceeding, you acknowledge that cancellation fees will apply
                        based on our refund policy. The closer to the service date you cancel,
                        the higher the non-refundable percentage.
                      </p>
                    </div>
                    <div className="mb-6">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          data-testid="booking-refund-policy-checkbox"
                          type="checkbox"
                          checked={paymentConfirmed}
                          onChange={(e) => setPaymentConfirmed(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">
                          I confirm that I understand the refund policy and want to proceed
                          with payment of ${pricing.total.toFixed(2)}.
                        </span>
                      </label>
                    </div>
                    {paymentConfirmed && (
                      <div className="mb-6">
                        {/* Promo Code Section */}
                        <div className="mb-4 border rounded p-4 bg-gray-50">
                          <p className="text-sm font-semibold mb-3">Have a Promo Code?</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter promo code"
                              value={promoCode}
                              onChange={(e) => {
                                setPromoCode(e.target.value.toUpperCase())
                                setPromoCodeError(null)
                              }}
                              className="flex-1"
                              disabled={promoCodeDiscount !== null}
                            />
                            {promoCodeDiscount === null ? (
                              <Button
                                type="button"
                                onClick={async () => {
                                  if (!promoCode.trim()) {
                                    setPromoCodeError("Please enter a promo code")
                                    return
                                  }
                                  
                                  setPromoCodeValidating(true)
                                  setPromoCodeError(null)
                                  
                                  try {
                                    const response = await fetch(
                                      `/api/referrals/validate?code=${encodeURIComponent(promoCode)}&total=${pricing.total}`
                                    )
                                    const data = await response.json()
                                    
                                    if (!response.ok || !data.valid) {
                                      setPromoCodeError(data.error || "Invalid promo code")
                                    } else {
                                      setPromoCodeDiscount(data.discount)
                                      setDiscountedTotal(data.discountedTotal)
                                      setPromoCodeError(null)
                                    }
                                  } catch (error) {
                                    setPromoCodeError("Failed to validate promo code")
                                  } finally {
                                    setPromoCodeValidating(false)
                                  }
                                }}
                                disabled={promoCodeValidating}
                                variant="outline"
                              >
                                {promoCodeValidating ? "Checking..." : "Apply"}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                onClick={() => {
                                  setPromoCode("")
                                  setPromoCodeDiscount(null)
                                  setDiscountedTotal(null)
                                  setPromoCodeError(null)
                                }}
                                variant="outline"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          {promoCodeError && (
                            <p className="text-sm text-red-600 mt-2">{promoCodeError}</p>
                          )}
                          {promoCodeDiscount !== null && (
                            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                              <p className="text-sm text-green-800 font-semibold">
                                ✓ Promo code applied! You save ${promoCodeDiscount.toFixed(2)}
                              </p>
                              <div className="flex justify-between mt-2 text-sm">
                                <span className="text-gray-600">Original Total:</span>
                                <span className="text-gray-600 line-through">${pricing.total.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-base font-bold">
                                <span className="text-green-800">New Total:</span>
                                <span className="text-green-800">${discountedTotal?.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {rewards.length > 0 && (
                          <div className="mb-4 border rounded p-3 bg-gray-50">
                            <p className="text-sm font-semibold mb-2">Apply Reward</p>
                            <select
                              className="border rounded px-2 py-1 text-sm w-full"
                              value={selectedRewardId || ""}
                              onChange={(e) =>
                                setSelectedRewardId(e.target.value || null)
                              }
                            >
                              <option value="">Do not apply reward</option>
                              {rewards.map((r) => (
                                <option key={r.id} value={r.id}>
                                  ${Number(r.amount).toFixed(2)} ({r.id.slice(0, 8)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <CheckoutForm
                          reservationId={reservationId}
                          total={discountedTotal !== null ? discountedTotal : pricing.total}
                          rewardId={selectedRewardId || undefined}
                          promoCode={promoCodeDiscount !== null ? promoCode : undefined}
                          hideContactInfo
                          initialCustomerInfo={customerInfo || undefined}
                          onSuccess={async (paymentIntentId) => {
                            setPaymentSucceeded(true)
                            
                            console.log("✅ Payment succeeded with intent:", paymentIntentId)
                            console.log("⏳ Webhook will convert reservation to booking and send confirmation")
                            
                            // Store payment info in localStorage as backup
                            localStorage.setItem('pendingBooking', JSON.stringify({
                              reservationId,
                              paymentIntentId,
                              timestamp: Date.now(),
                            }))
                            
                            router.push("/bookings/success")
                          }}
                          onError={(error) => {
                            setErrorMessage(`Payment failed: ${error}`)
                          }}
                        />
                      </div>
                    )}
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setStep(2)}
                      >
                        Back
                      </Button>
                  {!paymentConfirmed && (
                    <Button
                      onClick={() => {
                        setErrorMessage("Please confirm that you understand the refund policy by checking the box above")
                      }}
                      className="flex-1"
                      size="lg"
                    >
                      Confirm to Continue
                    </Button>
                  )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Price Breakdown Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {pricing && (
            <PriceBreakdown 
              pricing={pricing} 
              selectedCars={selectedCars} 
              cars={cars}
              promoCode={promoCodeDiscount !== null ? promoCode : undefined}
              promoDiscount={promoCodeDiscount !== null ? promoCodeDiscount : undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <BookPageContent />
    </Suspense>
  )
}

