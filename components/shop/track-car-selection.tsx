"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Plus, X } from "lucide-react"

interface Car {
  id: string
  name: string
  description?: string | null
  category: string
  type?: string | null
  basePricePerDay: number
  stockQuantity: number
  imageUrls: string[]
}

interface TrackCarSelectionProps {
  trackId: string
  trackBasePrice: number
  matchingCars: Car[]
  includedCarIds: string[]
}

export function TrackCarSelection({
  trackId,
  trackBasePrice,
  matchingCars,
  includedCarIds,
}: TrackCarSelectionProps) {
  const [selectedIncludedCars, setSelectedIncludedCars] = useState<string[]>(includedCarIds.slice(0, 2))
  const [additionalCars, setAdditionalCars] = useState<Record<string, number>>({})

  // Sync with localStorage to persist selection
  useEffect(() => {
    const saved = localStorage.getItem(`track-${trackId}-cars`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.includedCars) {
          setSelectedIncludedCars(parsed.includedCars)
        }
        if (parsed.additionalCars) {
          setAdditionalCars(parsed.additionalCars)
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [trackId])

  // Save to localStorage whenever selection changes
  useEffect(() => {
    localStorage.setItem(
      `track-${trackId}-cars`,
      JSON.stringify({
        includedCars: selectedIncludedCars,
        additionalCars,
      })
    )
    // Dispatch custom event to notify price summary
    window.dispatchEvent(new Event("carSelectionChanged"))
  }, [trackId, selectedIncludedCars, additionalCars])

  const handleSelectIncludedCar = (carId: string) => {
    if (selectedIncludedCars.includes(carId)) {
      // Deselect
      setSelectedIncludedCars(selectedIncludedCars.filter((id) => id !== carId))
    } else if (selectedIncludedCars.length < 2) {
      // Select (max 2)
      setSelectedIncludedCars([...selectedIncludedCars, carId])
    } else {
      // Replace first selected
      setSelectedIncludedCars([carId, selectedIncludedCars[1]])
    }
  }

  const handleAddAdditionalCar = (carId: string) => {
    setAdditionalCars((prev) => ({
      ...prev,
      [carId]: (prev[carId] || 0) + 1,
    }))
  }

  const handleRemoveAdditionalCar = (carId: string) => {
    setAdditionalCars((prev) => {
      const newCount = (prev[carId] || 0) - 1
      if (newCount <= 0) {
        const { [carId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [carId]: newCount }
    })
  }

  const isIncluded = (carId: string) => selectedIncludedCars.includes(carId)
  const isAdditional = (carId: string) => (additionalCars[carId] || 0) > 0

  return (
    <div className="space-y-6">
      {/* Included Cars Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Included Cars (Select 2 - FREE)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matchingCars.map((car) => {
            const included = isIncluded(car.id)
            return (
              <Card
                key={car.id}
                className={`cursor-pointer transition-all ${
                  included
                    ? "ring-2 ring-blue-500 bg-blue-50"
                    : "hover:shadow-md"
                }`}
                onClick={() => handleSelectIncludedCar(car.id)}
              >
                <CardContent className="p-4">
                  <div className="relative h-32 w-full bg-gray-100 rounded mb-3 overflow-hidden">
                    {car.imageUrls && car.imageUrls.length > 0 ? (
                      <Image
                        src={car.imageUrls[0]}
                        alt={car.name}
                        fill
                        className="object-contain object-center"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No Image
                      </div>
                    )}
                    {included && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{car.name}</h4>
                  {car.type && (
                    <p className="text-xs text-gray-500 mb-2">{car.type}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-600">
                      Included
                    </span>
                    {included && (
                      <span className="text-xs text-blue-600">Selected</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        {selectedIncludedCars.length < 2 && (
          <p className="text-sm text-yellow-600 mt-2">
            Please select {2 - selectedIncludedCars.length} more car{2 - selectedIncludedCars.length > 1 ? "s" : ""} to include
          </p>
        )}
      </div>

      {/* Additional Cars Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Additional Cars (Add for Extra Cost)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matchingCars.map((car) => {
            const additionalCount = additionalCars[car.id] || 0
            const isSelectedAsIncluded = isIncluded(car.id)
            
            // Don't show cars that are selected as included
            if (isSelectedAsIncluded) return null

            return (
              <Card
                key={car.id}
                className={`${
                  additionalCount > 0 ? "ring-2 ring-green-500 bg-green-50" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="relative h-32 w-full bg-gray-100 rounded mb-3 overflow-hidden">
                    {car.imageUrls && car.imageUrls.length > 0 ? (
                      <Image
                        src={car.imageUrls[0]}
                        alt={car.name}
                        fill
                        className="object-contain object-center"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No Image
                      </div>
                    )}
                    {additionalCount > 0 && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full px-2 py-1 text-xs font-bold">
                        {additionalCount}
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{car.name}</h4>
                  {car.type && (
                    <p className="text-xs text-gray-500 mb-2">{car.type}</p>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      ${Number(car.basePricePerDay).toFixed(2)}/day
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {additionalCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveAdditionalCar(car.id)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant={additionalCount > 0 ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddAdditionalCar(car.id)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {additionalCount > 0 ? `Add More (${additionalCount})` : "Add Car"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

