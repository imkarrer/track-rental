import { describe, it, expect } from "vitest"
import {
  calculatePricing,
  calculateDistanceSurcharge,
  calculateDurationHours,
  getDurationMultiplier,
  getDayMultiplier,
} from "@/lib/pricing/calculate"

describe("pricing/calculate helpers", () => {
  it("computes distance surcharge tiers", () => {
    expect(calculateDistanceSurcharge(5)).toBe(0)
    expect(calculateDistanceSurcharge(15)).toBe(25)
    expect(calculateDistanceSurcharge(35)).toBe(50)
    expect(calculateDistanceSurcharge(60)).toBe(120) // 100 + (10 * 2)
  })

  it("computes duration hours including overnight", () => {
    expect(calculateDurationHours("10:00", "14:00")).toBe(4)
    expect(calculateDurationHours("22:00", "01:00")).toBe(3) // wraps next day
  })

  it("returns default day multipliers", () => {
    expect(getDayMultiplier(0)).toBe(1.3)
    expect(getDayMultiplier(6)).toBe(1.5)
  })

  it("returns duration multipliers", () => {
    expect(getDurationMultiplier(3)).toBe(0.7)
    expect(getDurationMultiplier(6)).toBe(1.0)
    expect(getDurationMultiplier(9)).toBe(1.3)
  })
})

describe("pricing/calculate main flow", () => {
  it("calculates pricing with 2 free cars and taxes", () => {
    const result = calculatePricing({
      trackBasePrice: 200,
      eventDate: new Date(Date.UTC(2025, 6, 8)), // Tuesday (multiplier 1.0)
      startTime: "10:00",
      endTime: "14:00",
      setupTimeMinutes: 30,
      distanceFromBase: 12, // $25
      selectedCars: [
        { carId: "a", basePricePerDay: 30, quantity: 2 }, // both free
        { carId: "b", basePricePerDay: 40, quantity: 1 }, // paid
      ],
      taxRate: 0.1,
    })

    // Day multiplier 1.0, duration 4h => 0.7x
    // Track: 200 * 1.0 * 0.7 = 140
    // Cars: first 2 free, 1 paid -> 40 * 1.0 * 0.7 = 28
    // Distance: 25, Setup: 0
    // Subtotal: 140 + 28 + 25 = 193
    // Tax 10%: 19.3, Total: 212.3
    expect(result.trackPrice).toBeCloseTo(140)
    expect(result.additionalCarsPrice).toBeCloseTo(28)
    expect(result.distanceSurcharge).toBe(25)
    expect(result.subtotal).toBeCloseTo(193)
    expect(result.tax).toBeCloseTo(19.3)
    expect(result.total).toBeCloseTo(212.3)
    expect(result.additionalCarsCount).toBe(1)
    expect(result.freeCarsIncluded).toBe(2)
  })
})

