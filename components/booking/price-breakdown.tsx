"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Car {
  id: string
  name: string
  type: string
  basePricePerDay: number
}

interface SelectedCar {
  carId: string
  quantity: number
}

interface PricingBreakdown {
  trackBasePrice?: number
  dayMultiplier?: number
  dayMultiplierSource?: string
  holidayName?: string | null
  dayName?: string
  durationMultiplier?: number
  trackPrice?: number
  freeCarsIncluded?: number
  additionalCarsCount?: number
  additionalCarsPrice?: number
  distanceSurcharge: number
  setupFee: number
  subtotal: number
  tax: number
  total: number
  dayOfWeek?: number
  durationHours?: number
  distanceResult?: {
    distanceMiles: number
    durationMinutes: number
  }
  // Multi-day pricing fields
  isMultiDay?: boolean
  days?: Array<{
    date: string
    dayOfWeek: number
    multiplier: number
    isHoliday: boolean
    trackPrice: number
    additionalCarsPrice: number
    subtotal: number
  }>
  totalTrackPrice?: number
  totalAdditionalCarsPrice?: number
  totalDays?: number
}

interface PriceBreakdownProps {
  pricing: PricingBreakdown
  selectedCars: SelectedCar[]
  cars: Car[]
  promoCode?: string
  promoDiscount?: number
}

export function PriceBreakdown({
  pricing,
  selectedCars,
  cars,
  promoCode,
  promoDiscount,
}: PriceBreakdownProps) {
  const finalTotal = promoDiscount ? pricing.total - promoDiscount : pricing.total
  const getDayName = (dayOfWeek: number): string => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    if (dayOfWeek === undefined || dayOfWeek === null || isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return "Unknown"
    }
    return days[dayOfWeek] || "Unknown"
  }

  const getCarName = (carId: string): string => {
    const car = cars.find((c) => c.id === carId)
    return car ? car.name : "Unknown Car"
  }

  // Handle multi-day pricing
  if (pricing.isMultiDay && pricing.days) {
    return (
      <Card className="sticky top-4" data-testid="booking-price-breakdown">
        <CardHeader>
          <CardTitle>Price Breakdown ({pricing.totalDays} days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="font-medium mb-2">Daily Breakdown:</div>
            {pricing.days.map((day, index) => (
              <div key={index} className="border rounded p-2 bg-gray-50">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">
                    {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-xs">
                    {day.isHoliday ? (
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                        Holiday
                      </span>
                    ) : (
                      <span className="text-gray-500">{getDayName(day.dayOfWeek)}</span>
                    )}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Multiplier:</span>
                    <span>{day.multiplier}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Track:</span>
                    <span>${day.trackPrice.toFixed(2)}</span>
                  </div>
                  {day.additionalCarsPrice > 0 && (
                    <div className="flex justify-between">
                      <span>Additional Cars:</span>
                      <span>${day.additionalCarsPrice.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-0.5 border-t">
                    <span>Day Total:</span>
                    <span>${day.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm pt-2 border-t">
            <div className="flex justify-between">
              <span>Total Track Price ({pricing.totalDays} days):</span>
              <span className="font-medium">${pricing.totalTrackPrice?.toFixed(2) || "0.00"}</span>
            </div>
            {pricing.totalAdditionalCarsPrice && pricing.totalAdditionalCarsPrice > 0 && (
              <div className="flex justify-between">
                <span>Total Additional Cars:</span>
                <span>${pricing.totalAdditionalCarsPrice.toFixed(2)}</span>
              </div>
            )}
            {pricing.distanceSurcharge > 0 && (
              <div className="flex justify-between">
                <span>
                  Distance Surcharge
                  {pricing.distanceResult && (
                    <span className="text-gray-600 text-xs ml-1">
                      ({pricing.distanceResult.distanceMiles.toFixed(1)} mi)
                    </span>
                  )}
                  :
                </span>
                <span>${pricing.distanceSurcharge.toFixed(2)}</span>
              </div>
            )}
            {pricing.setupFee > 0 && (
              <div className="flex justify-between">
                <span>Setup Fee:</span>
                <span>${pricing.setupFee.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">${pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8%):</span>
              <span>${pricing.tax.toFixed(2)}</span>
            </div>
            {promoDiscount && promoDiscount > 0 ? (
              <>
                <div className="flex justify-between pt-2 border-t">
                  <span>Subtotal + Tax:</span>
                  <span className="font-medium line-through text-gray-500">${pricing.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <span className="text-base">🎉</span>
                    Promo Code ({promoCode}):
                  </span>
                  <span className="font-medium">-${promoDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t border-green-200 bg-green-50 -mx-4 px-4 py-2 rounded">
                  <span>Total:</span>
                  <span className="text-green-700">${finalTotal.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total:</span>
                <span>${pricing.total.toFixed(2)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Single day pricing (existing logic)
  return (
    <Card className="sticky top-4" data-testid="booking-price-breakdown">
      <CardHeader>
        <CardTitle>Price Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Track Base Price:</span>
            <span>${(pricing.trackBasePrice || 0).toFixed(2)}</span>
          </div>
          {pricing.dayOfWeek !== undefined && 
           pricing.dayOfWeek !== null && 
           !isNaN(Number(pricing.dayOfWeek)) &&
           pricing.dayMultiplier !== undefined && (
            <div className="flex justify-between text-gray-600">
              <span>
                Day Multiplier{" "}
                {pricing.dayMultiplierSource && (
                  <span className="text-xs text-blue-600 ml-1">
                    {pricing.dayMultiplierSource === "holiday" || pricing.dayMultiplierSource === "holiday-smart"
                      ? pricing.holidayName || "Holiday"
                      : pricing.dayName || getDayName(Number(pricing.dayOfWeek))}
                  </span>
                )}
                {!pricing.dayMultiplierSource && (
                  <span className="text-xs text-blue-600 ml-1">
                    {pricing.dayName || getDayName(Number(pricing.dayOfWeek))}
                  </span>
                )}
                :
              </span>
              <span>{pricing.dayMultiplier}x</span>
            </div>
          )}
          {pricing.durationHours !== undefined && pricing.durationMultiplier !== undefined && (
            <div className="flex justify-between text-gray-600">
              <span>Duration Multiplier ({pricing.durationHours} hrs):</span>
              <span>{pricing.durationMultiplier}x</span>
            </div>
          )}
          <div className="flex justify-between font-medium pt-2 border-t">
            <span>Track Price:</span>
            <span>${(pricing.trackPrice || 0).toFixed(2)}</span>
          </div>
        </div>

        {selectedCars.length > 0 && (
          <div className="space-y-2 text-sm pt-2 border-t">
            <div className="font-medium mb-2">Cars:</div>
            {selectedCars.map((selected) => {
              const car = cars.find((c) => c.id === selected.carId)
              const totalQuantity = selectedCars.reduce((sum, sc) => sum + sc.quantity, 0)
              const isFree = selected.quantity > 0 && totalQuantity <= 2
              
              return (
                <div key={selected.carId} className="text-gray-600">
                  <div className="flex justify-between">
                    <span>
                      {getCarName(selected.carId)} × {selected.quantity}
                    </span>
                    <span className={isFree ? "text-green-600 font-medium" : ""}>
                      {isFree ? "FREE" : `$${(car ? Number(car.basePricePerDay) * selected.quantity : 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              )
            })}
            {(pricing.additionalCarsCount ?? 0) > 0 && (
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>Additional Cars ({pricing.additionalCarsCount}):</span>
                <span>${(pricing.additionalCarsPrice ?? 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 text-sm pt-2 border-t">
          {pricing.distanceSurcharge > 0 && (
            <div className="flex justify-between">
              <span>
                Distance Surcharge
                {pricing.distanceResult && (
                  <span className="text-gray-600 text-xs ml-1">
                    ({pricing.distanceResult.distanceMiles.toFixed(1)} mi)
                  </span>
                )}
                :
              </span>
              <span>${pricing.distanceSurcharge.toFixed(2)}</span>
            </div>
          )}
        </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">${pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8%):</span>
              <span>${pricing.tax.toFixed(2)}</span>
            </div>
            {promoDiscount && promoDiscount > 0 ? (
              <>
                <div className="flex justify-between pt-2 border-t">
                  <span>Subtotal + Tax:</span>
                  <span className="font-medium line-through text-gray-500">${pricing.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <span className="text-base">🎉</span>
                    Promo Code ({promoCode}):
                  </span>
                  <span className="font-medium">-${promoDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t border-green-200 bg-green-50 -mx-4 px-4 py-2 rounded">
                  <span>Total:</span>
                  <span className="text-green-700">${finalTotal.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total:</span>
                <span>${pricing.total.toFixed(2)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

