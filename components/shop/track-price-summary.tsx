"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TrackPriceSummaryProps {
  trackId: string
  trackBasePrice: number
}

export function TrackPriceSummary({ trackId, trackBasePrice }: TrackPriceSummaryProps) {
  const [pricing, setPricing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [additionalCarsPrice, setAdditionalCarsPrice] = useState(0)

  const calculatePrice = () => {
    // Get selected cars from localStorage
    const saved = localStorage.getItem(`track-${trackId}-cars`)
    if (!saved) {
      setPricing(null)
      setLoading(false)
      return
    }

    try {
      const parsed = JSON.parse(saved)
      const includedCars = parsed.includedCars || []
      const additionalCars = parsed.additionalCars || {}

      // For now, use default values for date/time (will be set in booking flow)
      // Calculate pricing with default 8-hour rental on Saturday
      const today = new Date()
      const saturday = new Date(today)
      saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7))
      saturday.setHours(10, 0, 0, 0)

      const endTime = new Date(saturday)
      endTime.setHours(18, 0, 0, 0)

      // Fetch car details to get prices
      fetch("/api/cars")
        .then((res) => res.json())
        .then((data) => {
          const cars = data.cars || []
          
          // Build selectedCars array for pricing calculation
          const selectedCars: Array<{ carId: string; basePricePerDay: number; quantity: number }> = []
          
          // Add included cars (2 free)
          includedCars.forEach((carId: string) => {
            const car = cars.find((c: any) => c.id === carId)
            if (car) {
              selectedCars.push({
                carId,
                basePricePerDay: Number(car.basePricePerDay),
                quantity: 1,
              })
            }
          })

          // Add additional cars
          Object.entries(additionalCars).forEach(([carId, quantity]) => {
            const car = cars.find((c: any) => c.id === carId)
            if (car && quantity > 0) {
              selectedCars.push({
                carId,
                basePricePerDay: Number(car.basePricePerDay),
                quantity: quantity as number,
              })
            }
          })

          if (selectedCars.length === 0) {
            setPricing(null)
            setLoading(false)
            return
          }

          // Calculate simple pricing (base prices only, no multipliers)
          // Track price: just the base price
          const trackPrice = trackBasePrice

          // Calculate additional cars cost (first 2 are free)
          const totalCarQuantity = selectedCars.reduce((sum, car) => sum + car.quantity, 0)
          const freeCarsIncluded = Math.min(2, totalCarQuantity)
          const additionalCarsCount = Math.max(0, totalCarQuantity - freeCarsIncluded)

          // Calculate additional cars price (base price only, no multipliers)
          let additionalCarsPrice = 0
          let remainingFree = freeCarsIncluded
          
          for (const car of selectedCars) {
            for (let i = 0; i < car.quantity; i++) {
              if (remainingFree > 0) {
                remainingFree--
              } else {
                additionalCarsPrice += car.basePricePerDay
              }
            }
          }

          const subtotal = trackPrice + additionalCarsPrice

          setAdditionalCarsPrice(additionalCarsPrice)
          
          // Dispatch event for DayMultipliersDisplay
          window.dispatchEvent(
            new CustomEvent("priceSummaryUpdate", {
              detail: { additionalCarsPrice },
            })
          )
          
          setPricing({
            trackPrice,
            freeCarsIncluded,
            additionalCarsCount,
            additionalCarsPrice,
            subtotal,
            distanceSurcharge: 0, // Will be calculated at booking
          })
        })
        .catch((error) => {
          console.error("Error calculating pricing:", error)
        })
        .finally(() => {
          setLoading(false)
        })
    } catch (e) {
      console.error("Error parsing saved cars:", e)
      setPricing(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    calculatePrice()

    // Listen for storage changes (when cars are selected/deselected)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `track-${trackId}-cars`) {
        calculatePrice()
      }
    }

    // Also listen for custom events (for same-tab updates)
    const handleCustomStorageChange = () => {
      calculatePrice()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("carSelectionChanged", handleCustomStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("carSelectionChanged", handleCustomStorageChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, trackBasePrice])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Calculating price...
        </CardContent>
      </Card>
    )
  }

  if (!pricing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Select 2 included cars to see pricing
          </p>
          <Link href={`/book?trackId=${trackId}`} className="block">
            <Button size="lg" className="w-full" disabled>
              Book This Track
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Track Base Price:</span>
            <span>${pricing.trackPrice.toFixed(2)}</span>
          </div>
          {pricing.freeCarsIncluded > 0 && (
            <div className="flex justify-between text-green-600">
              <span>{pricing.freeCarsIncluded} Car(s) Included:</span>
              <span>FREE</span>
            </div>
          )}
          {pricing.additionalCarsCount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">
                {pricing.additionalCarsCount} Additional Car(s):
              </span>
              <span>${pricing.additionalCarsPrice.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500 italic">
            <span>Distance Surcharge:</span>
            <span>Calculated at booking</span>
          </div>
          <div className="flex justify-between pt-2 border-t font-medium">
            <span>Subtotal (excl. distance):</span>
            <span>${pricing.subtotal.toFixed(2)}</span>
          </div>
          <div className="text-xs text-gray-500">
            * Final price includes day/duration multipliers and distance surcharge based on event details
          </div>
        </div>
        <Link href={`/book?trackId=${trackId}`} className="block">
          <Button size="lg" className="w-full">
            Book This Track
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

