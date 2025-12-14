"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

interface Car {
  id: string
  name: string
  type: string
  basePricePerDay: number
  stockQuantity: number
  category: string
  imageUrls: string[]
  unitCost?: number | null
}

interface TrackCarSelectionProps {
  category: "ROAD" | "OFFROAD"
  selectedCarIds: string[]
  onChange: (carIds: string[]) => void
  required?: boolean
}

export function TrackCarSelection({
  category,
  selectedCarIds,
  onChange,
  required = true,
}: TrackCarSelectionProps) {
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCars()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const fetchCars = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cars?category=${category}`)
      const data = await response.json()
      const filteredCars = data.cars || []
      setCars(filteredCars)
      
      // Remove any selected cars that don't match the current category
      const validCarIds = filteredCars.map((car: Car) => car.id)
      const invalidSelectedIds = selectedCarIds.filter(id => !validCarIds.includes(id))
      if (invalidSelectedIds.length > 0) {
        // Only keep cars that match the current category
        const validSelectedIds = selectedCarIds.filter(id => validCarIds.includes(id))
        onChange(validSelectedIds)
      }
    } catch (error) {
      console.error("Error fetching cars:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCar = (carId: string) => {
    if (selectedCarIds.includes(carId)) {
      // Remove car
      onChange(selectedCarIds.filter((id) => id !== carId))
    } else {
      // Add car (max 2)
      if (selectedCarIds.length < 2) {
        onChange([...selectedCarIds, carId])
      } else {
        alert("You can only select 2 cars to include with the track")
      }
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading cars...</div>
  }

  if (cars.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">
            Included Cars (Select 2) {required && "*"}
          </label>
        </div>
        <div className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-md p-3">
          ⚠️ No {category.toLowerCase()} cars available. Create cars first.
        </div>
        <p className="text-xs text-gray-500">
          You must create at least 2 {category.toLowerCase()} cars before you can create a {category.toLowerCase()} track.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          Included Cars (Select 2) {required && "*"}
        </label>
        <span className="text-xs text-gray-500">
          {selectedCarIds.length}/2 selected
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Select 2 <strong>{category.toLowerCase()}</strong> cars that will be included FREE with this {category.toLowerCase()} track rental. These cars will be included in the break-even cost analysis.
      </p>
      <p className="text-xs text-blue-600 mb-3 font-medium">
        ⓘ Only {category.toLowerCase()} cars are available for {category.toLowerCase()} tracks.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cars.map((car) => {
          const isSelected = selectedCarIds.includes(car.id)
          const imageUrl =
            car.imageUrls && car.imageUrls.length > 0
              ? car.imageUrls[0]
              : "/placeholder-car.jpg"

          return (
            <Card
              key={car.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              } ${selectedCarIds.length >= 2 && !isSelected ? "opacity-50" : ""}`}
              onClick={() => toggleCar(car.id)}
            >
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <div className="relative h-16 w-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                    {imageUrl.startsWith("http") || imageUrl.startsWith("/") ? (
                      <Image
                        src={imageUrl}
                        alt={car.name}
                        fill
                        className="object-contain object-center"
                        sizes="64px"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{car.name}</h4>
                        <p className="text-xs text-gray-600">{car.type}</p>
                        {car.unitCost && (
                          <p className="text-xs text-gray-500 mt-1">
                            Cost: ${Number(car.unitCost).toFixed(2)}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {required && selectedCarIds.length < 2 && (
        <p className="text-xs text-red-600 mt-2">
          Please select 2 cars to include with this track
        </p>
      )}
    </div>
  )
}

