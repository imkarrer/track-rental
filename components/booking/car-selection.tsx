"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"

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

interface CarSelectionProps {
  cars: Car[]
  selectedCars: SelectedCar[]
  onChange: (selectedCars: SelectedCar[]) => void
}

export function CarSelection({
  cars,
  selectedCars,
  onChange,
}: CarSelectionProps) {
  const getCarQuantity = (carId: string): number => {
    const selected = selectedCars.find((sc) => sc.carId === carId)
    return selected?.quantity || 0
  }

  const updateCarQuantity = (carId: string, quantity: number) => {
    const newSelectedCars = [...selectedCars]
    const index = newSelectedCars.findIndex((sc) => sc.carId === carId)

    if (quantity === 0) {
      // Remove car from selection
      if (index !== -1) {
        newSelectedCars.splice(index, 1)
      }
    } else {
      // Add or update car quantity
      if (index !== -1) {
        newSelectedCars[index].quantity = quantity
      } else {
        newSelectedCars.push({ carId, quantity })
      }
    }

    onChange(newSelectedCars)
  }

  const getTotalQuantity = (): number => {
    return selectedCars.reduce((total, sc) => total + sc.quantity, 0)
  }

  const getFreeCarsRemaining = (): number => {
    const total = getTotalQuantity()
    return Math.max(0, 2 - total)
  }

  const totalQuantity = getTotalQuantity()
  const freeCarsRemaining = getFreeCarsRemaining()

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm font-medium text-blue-900">
          First 2 cars are FREE with track rental
        </p>
        <p className="text-xs text-blue-700 mt-1">
          {freeCarsRemaining > 0
            ? `${freeCarsRemaining} free car${freeCarsRemaining > 1 ? "s" : ""} remaining`
            : "All free cars used. Additional cars will be charged."}
        </p>
      </div>

      {cars.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No cars available for this track category
        </p>
      ) : (
        <div className="space-y-4">
          {cars.map((car) => {
            const quantity = getCarQuantity(car.id)
            const isFree = quantity > 0 && totalQuantity <= 2
            const imageUrl =
              car.imageUrls && car.imageUrls.length > 0
                ? car.imageUrls[0]
                : "/placeholder-car.jpg"

            return (
              <Card key={car.id} className={quantity > 0 ? "border-blue-500" : ""}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                      {imageUrl.startsWith("http") || imageUrl.startsWith("/") ? (
                        <Image
                          src={imageUrl}
                          alt={car.name}
                          fill
                          className="object-contain object-center"
                          sizes="96px"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{car.name}</h3>
                      <p className="text-sm text-gray-600">{car.type}</p>
                      <p className="text-sm text-gray-600">
                        Stock: {car.stockQuantity} | $
                        {Number(car.basePricePerDay).toFixed(2)}/day
                      </p>
                      {quantity > 0 && (
                        <p className="text-sm font-medium text-green-600 mt-1">
                          {isFree ? "FREE (included)" : "Additional car"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCarQuantity(car.id, Math.max(0, quantity - 1))}
                        disabled={quantity === 0}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">{quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateCarQuantity(
                            car.id,
                            Math.min(car.stockQuantity, quantity + 1)
                          )
                        }
                        disabled={quantity >= car.stockQuantity}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

