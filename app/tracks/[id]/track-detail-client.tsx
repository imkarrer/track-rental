"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Track {
  id: string
  name: string
  description: string | null
  category: string
  basePrice: number
  length: number
  width: number
  minSpaceLength: number
  minSpaceWidth: number
  setupTimeMinutes: number
  imageUrls: string[]
  includedCarIds: string[]
}

interface Car {
  id: string
  name: string
  type: string
  category: string
  basePricePerDay: number
  imageUrls: string[]
  stockQuantity: number
}

interface TrackDetailClientProps {
  trackId: string
}

export default function TrackDetailClient({ trackId }: TrackDetailClientProps) {
  const router = useRouter()
  const [track, setTrack] = useState<Track | null>(null)
  const [availableCars, setAvailableCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set())
  const [carQuantities, setCarQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch track details
        const trackRes = await fetch(`/api/tracks/${trackId}`)
        const trackData = await trackRes.json()
        
        if (!trackData.track) {
          router.push("/tracks")
          return
        }
        
        setTrack(trackData.track)

        // Fetch available cars (matching track category)
        const carsRes = await fetch(`/api/cars?category=${trackData.track.category}`)
        const carsData = await carsRes.json()
        
        // Filter to only active cars with stock
        const activeCars = (carsData.cars || []).filter(
          (car: Car) => car.stockQuantity > 0
        )
        setAvailableCars(activeCars)

        // Load saved selections from localStorage
        const saved = localStorage.getItem(`track-${trackId}-cars`)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            const includedCars = new Set(parsed.includedCars || [])
            const additionalCars = parsed.additionalCars || {}
            
            // Build selectedCars from both included and additional
            const allSelected = new Set<string>([
              ...Array.from(includedCars as Set<string>),
              ...Object.keys(additionalCars).filter(id => additionalCars[id] > 0)
            ])
            
            setSelectedCars(allSelected)
            setCarQuantities(additionalCars)
          } catch (e) {
            console.error("Error loading saved selections:", e)
          }
        } else {
          // Auto-select included cars by default
          if (trackData.track.includedCarIds && trackData.track.includedCarIds.length > 0) {
            setSelectedCars(new Set(trackData.track.includedCarIds))
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [trackId, router])

  const toggleCarSelection = (carId: string) => {
    const newSelected = new Set(selectedCars)
    if (newSelected.has(carId)) {
      newSelected.delete(carId)
      // Also remove from quantities
      const newQuantities = { ...carQuantities }
      delete newQuantities[carId]
      setCarQuantities(newQuantities)
    } else {
      newSelected.add(carId)
      // Default quantity is 1
      setCarQuantities({ ...carQuantities, [carId]: 1 })
    }
    setSelectedCars(newSelected)
  }

  const updateQuantity = (carId: string, quantity: number) => {
    if (quantity < 1) {
      // Remove from selection if quantity is 0
      const newSelected = new Set(selectedCars)
      newSelected.delete(carId)
      setSelectedCars(newSelected)
      
      const newQuantities = { ...carQuantities }
      delete newQuantities[carId]
      setCarQuantities(newQuantities)
    } else {
      setCarQuantities({ ...carQuantities, [carId]: quantity })
    }
  }

  const proceedToBooking = () => {
    if (!track) return

    // Save selections to localStorage
    const includedCarIds = track.includedCarIds || []
    const selectedIncluded = Array.from(selectedCars).filter(id => 
      includedCarIds.includes(id)
    )
    
    const additionalCars: Record<string, number> = {}
    selectedCars.forEach(carId => {
      if (!includedCarIds.includes(carId)) {
        additionalCars[carId] = carQuantities[carId] || 1
      }
    })

    localStorage.setItem(`track-${trackId}-cars`, JSON.stringify({
      includedCars: selectedIncluded,
      additionalCars: additionalCars
    }))

    // Navigate to booking page
    router.push(`/book?trackId=${trackId}`)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
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

  const imageUrl = track.imageUrls && track.imageUrls.length > 0
    ? track.imageUrls[0]
    : "/placeholder-track.jpg"

  const selectedCount = selectedCars.size
  
  // Calculate selected cars as array to determine order/position
  const selectedCarsArray = Array.from(selectedCars)
  
  // Calculate total quantity including additional car quantities
  const getTotalQuantity = () => {
    let total = 0
    selectedCars.forEach(carId => {
      const quantity = carQuantities[carId] || 1
      total += quantity
    })
    return total
  }
  
  const totalQuantity = getTotalQuantity()

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section - More Compact */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/tracks")}
          >
            ← Back to Tracks
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Track Image */}
          <div className="lg:col-span-1">
            <div className="relative h-64 w-full bg-gray-100 rounded-lg overflow-hidden shadow-md">
              {imageUrl.startsWith("http") || imageUrl.startsWith("/") ? (
                <Image
                  src={imageUrl}
                  alt={track.name}
                  fill
                  className="object-contain"
                  sizes="400px"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <span>No Image</span>
                </div>
              )}
            </div>
          </div>

          {/* Track Info - Condensed */}
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-3xl font-bold">{track.name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                track.category === "ROAD"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-green-100 text-green-800"
              }`}>
                {track.category === "ROAD" ? "Road" : "Offroad"}
              </span>
            </div>
            
            {track.description && (
              <p className="text-gray-600 mb-4 text-sm">{track.description}</p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Dimensions</p>
                <p className="font-semibold">{track.length}′ × {track.width}′</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Min Space</p>
                <p className="font-semibold">{track.minSpaceLength}′ × {track.minSpaceWidth}′</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Setup Time</p>
                <p className="font-semibold">{track.setupTimeMinutes} min</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">Base Price</p>
                <p className="font-bold text-blue-700 text-lg">${track.basePrice.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-amber-900 mb-2">📦 Includes 2 FREE Cars</p>
              <p className="text-xs text-amber-700">Choose any 2 cars below - additional cars cost ${availableCars[0]?.basePricePerDay.toFixed(2)}/day each</p>
            </div>
          </div>
        </div>
      </div>

          {/* Car Selection Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* All Cars in Single Pane */}
          <Card data-testid="track-detail-car-selection-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏎️</span>
                  <span>Select Your Cars</span>
                </div>
                <span data-testid="track-detail-car-selection-count" className="text-sm font-normal text-gray-500">
                  {selectedCount} of 2 free selected
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableCars.map((car, index) => {
                  const carImage = car.imageUrls?.[0] || "/placeholder-car.jpg"
                  const isSelected = selectedCars.has(car.id)
                  const quantity = carQuantities[car.id] || 1
                  const selectionIndex = selectedCarsArray.indexOf(car.id)
                  const isFree = selectionIndex < 2
                  
                  return (
                    <div
                      key={car.id}
                      className={`relative flex gap-3 p-4 border-2 rounded-lg transition-all ${
                        isSelected
                          ? isFree
                            ? "border-green-500 bg-green-50"
                            : "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      {isSelected && isFree && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {selectionIndex + 1}
                        </div>
                      )}
                      <div 
                        onClick={() => {
                          // Only allow toggle if not at quantity > 1
                          if (quantity === 1) {
                            toggleCarSelection(car.id)
                          }
                        }}
                        className={`relative h-16 w-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden ${quantity === 1 ? 'cursor-pointer' : ''}`}
                      >
                        {carImage.startsWith("http") || carImage.startsWith("/") ? (
                          <Image
                            src={carImage}
                            alt={car.name}
                            fill
                            className="object-contain"
                            sizes="64px"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">No Image</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{car.name}</p>
                        <p className="text-xs text-gray-500">{car.type}</p>
                        {isSelected ? (
                          <>
                            {isFree && quantity === 1 ? (
                              <p className="text-xs text-green-600 font-medium mt-1">FREE</p>
                            ) : (
                              <p className="text-xs text-blue-600 font-medium mt-1">
                                ${car.basePricePerDay.toFixed(2)}/day
                              </p>
                            )}
                            {!isFree && (
                              <div className="flex items-center gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => updateQuantity(car.id, quantity - 1)}
                                >
                                  −
                                </Button>
                                <span className="text-sm font-medium w-8 text-center">{quantity}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => updateQuantity(car.id, quantity + 1)}
                                >
                                  +
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto text-xs"
                                  onClick={() => toggleCarSelection(car.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            )}
                            {isFree && quantity === 1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 w-full text-xs"
                                onClick={() => toggleCarSelection(car.id)}
                              >
                                Deselect
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-gray-500 mt-1">
                              ${car.basePricePerDay.toFixed(2)}/day
                            </p>
                            <Button
                              size="sm"
                              className="mt-2 w-full"
                              onClick={() => toggleCarSelection(car.id)}
                            >
                              Select
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sticky Cart Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Your Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Track Rental</span>
                  <span className="font-semibold">${track.basePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cars Selected</span>
                  <span className="font-semibold">{totalQuantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">• First 2 FREE</span>
                  <span className="font-semibold">{Math.min(totalQuantity, 2)}</span>
                </div>
                {totalQuantity > 2 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600">• Additional</span>
                    <span className="font-semibold">{totalQuantity - 2}</span>
                  </div>
                )}
              </div>

              {selectedCount > 0 && (
                <div className="pt-2 space-y-1">
                  {Array.from(selectedCars).map((carId, index) => {
                    const car = availableCars.find(c => c.id === carId)
                    if (!car) return null
                    const quantity = carQuantities[carId] || 1
                    const isFree = index < 2 && quantity === 1
                    
                    return (
                      <div key={carId} className="flex justify-between text-xs">
                        <span className="text-gray-600">
                          {car.name} {quantity > 1 && `×${quantity}`}
                        </span>
                        <span className={isFree ? "text-green-600 font-medium" : "text-gray-600"}>
                          {isFree ? "FREE" : `$${(car.basePricePerDay * quantity).toFixed(2)}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500 mb-3">
                  * Final price calculated at checkout based on date, duration, and location
                </p>
                <Button
                  data-testid="track-detail-continue-booking-button"
                  onClick={proceedToBooking}
                  disabled={selectedCount === 0}
                  className="w-full"
                  size="lg"
                >
                  Continue to Booking →
                </Button>
                {selectedCount === 0 && (
                  <p className="text-xs text-red-500 mt-2 text-center">
                    Please select at least one car
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
