import { describe, it, expect } from "vitest"
import {
  calculatePricing,
  calculateDistanceSurcharge,
  calculateDurationHours,
  calculateSetupFee,
  getDurationMultiplier,
  getDayMultiplier,
} from "@/lib/pricing/calculate"

describe("pricing/calculate extended coverage", () => {
  describe("calculateSetupFee", () => {
    it("returns $0 for setup time under 30 minutes", () => {
      expect(calculateSetupFee(0)).toBe(0)
      expect(calculateSetupFee(15)).toBe(0)
      expect(calculateSetupFee(29)).toBe(0)
    })

    it("returns $50 for setup time 30-60 minutes", () => {
      expect(calculateSetupFee(30)).toBe(50)
      expect(calculateSetupFee(45)).toBe(50)
      expect(calculateSetupFee(60)).toBe(50)
    })

    it("returns $100 for setup time over 60 minutes", () => {
      expect(calculateSetupFee(61)).toBe(100)
      expect(calculateSetupFee(90)).toBe(100)
      expect(calculateSetupFee(120)).toBe(100)
    })
  })

  describe("getDayMultiplier edge cases", () => {
    it("returns 1.0 for unknown day of week", () => {
      expect(getDayMultiplier(7)).toBe(1.0)
      expect(getDayMultiplier(-1)).toBe(1.0)
    })

    it("returns correct multipliers for all days", () => {
      expect(getDayMultiplier(0)).toBe(1.3) // Sunday
      expect(getDayMultiplier(1)).toBe(1.0) // Monday
      expect(getDayMultiplier(2)).toBe(1.0) // Tuesday
      expect(getDayMultiplier(3)).toBe(1.0) // Wednesday
      expect(getDayMultiplier(4)).toBe(1.0) // Thursday
      expect(getDayMultiplier(5)).toBe(1.2) // Friday
      expect(getDayMultiplier(6)).toBe(1.5) // Saturday
    })
  })

  describe("getDurationMultiplier edge cases", () => {
    it("handles boundary conditions", () => {
      expect(getDurationMultiplier(4)).toBe(0.7)
      expect(getDurationMultiplier(4.5)).toBe(1.0)
      expect(getDurationMultiplier(8)).toBe(1.0)
      expect(getDurationMultiplier(8.1)).toBe(1.3)
    })

    it("handles extreme values", () => {
      expect(getDurationMultiplier(0)).toBe(0.7)
      expect(getDurationMultiplier(1)).toBe(0.7)
      expect(getDurationMultiplier(24)).toBe(1.3)
    })
  })

  describe("calculateDurationHours edge cases", () => {
    it("handles exact hour boundaries", () => {
      expect(calculateDurationHours("00:00", "00:00")).toBe(0)
      expect(calculateDurationHours("10:00", "10:00")).toBe(0)
    })

    it("handles midnight crossing", () => {
      expect(calculateDurationHours("23:00", "02:00")).toBe(3)
      expect(calculateDurationHours("22:30", "00:30")).toBe(2)
    })

    it("rounds up partial hours", () => {
      expect(calculateDurationHours("10:00", "10:30")).toBe(1)
      expect(calculateDurationHours("10:00", "11:15")).toBe(2)
    })
  })

  describe("calculateDistanceSurcharge edge cases", () => {
    it("handles exact tier boundaries", () => {
      expect(calculateDistanceSurcharge(10)).toBe(0)
      expect(calculateDistanceSurcharge(10.1)).toBe(25)
      expect(calculateDistanceSurcharge(25)).toBe(25)
      expect(calculateDistanceSurcharge(25.1)).toBe(50)
      expect(calculateDistanceSurcharge(50)).toBe(50)
      expect(calculateDistanceSurcharge(50.1)).toBe(100.2)
    })

    it("handles zero distance", () => {
      expect(calculateDistanceSurcharge(0)).toBe(0)
    })
  })

  describe("calculatePricing edge cases", () => {
    it("handles no cars selected", () => {
      const result = calculatePricing({
        trackBasePrice: 200,
        eventDate: new Date(Date.UTC(2025, 0, 6)), // Monday
        startTime: "10:00",
        endTime: "14:00",
        setupTimeMinutes: 15,
        distanceFromBase: 5,
        selectedCars: [],
        taxRate: 0.08,
      })

      expect(result.additionalCarsCount).toBe(0)
      expect(result.additionalCarsPrice).toBe(0)
      expect(result.freeCarsIncluded).toBe(2)
    })

    it("uses provided dayMultiplier override", () => {
      const result = calculatePricing({
        trackBasePrice: 200,
        eventDate: new Date(Date.UTC(2025, 0, 6)), // Monday (normally 1.0)
        startTime: "10:00",
        endTime: "18:00",
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: [],
        dayMultiplier: 2.0, // Override to 2.0
      })

      expect(result.dayMultiplier).toBe(2.0)
      expect(result.trackPrice).toBe(400) // 200 * 2.0 * 1.0
    })

    it("handles more than 2 free cars correctly", () => {
      const result = calculatePricing({
        trackBasePrice: 100,
        eventDate: new Date(2025, 0, 7), // Use local time
        startTime: "10:00",
        endTime: "18:00", // 8 hours = 1.0 multiplier
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: [
          { carId: "a", basePricePerDay: 50, quantity: 4 }, // 2 free, 2 paid
        ],
        dayMultiplier: 1.0, // Explicitly set to avoid timezone issues
        taxRate: 0,
      })

      expect(result.freeCarsIncluded).toBe(2)
      expect(result.additionalCarsCount).toBe(2)
      // 2 paid cars * $50 * 1.0 (dayMultiplier) * 1.0 (durationMultiplier) = $100
      expect(result.additionalCarsPrice).toBe(100)
    })

    it("handles multiple car types with free allocation", () => {
      const result = calculatePricing({
        trackBasePrice: 100,
        eventDate: new Date(2025, 0, 7), // Tuesday in local time (1.0 multiplier)
        startTime: "10:00",
        endTime: "18:00", // 8 hours = 1.0 duration multiplier
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: [
          { carId: "a", basePricePerDay: 30, quantity: 1 }, // free
          { carId: "b", basePricePerDay: 40, quantity: 1 }, // free
          { carId: "c", basePricePerDay: 50, quantity: 2 }, // both paid
        ],
        taxRate: 0,
      })

      expect(result.additionalCarsCount).toBe(2)
      expect(result.dayMultiplier).toBe(1.0)
      expect(result.durationMultiplier).toBe(1.0)
      // 2 paid cars at $50 * 1.0 * 1.0 = $100
      expect(result.additionalCarsPrice).toBe(100)
    })

    it("uses default tax rate of 8%", () => {
      const result = calculatePricing({
        trackBasePrice: 100,
        eventDate: new Date(2025, 0, 7), // Tuesday in local time (1.0 multiplier)
        startTime: "10:00",
        endTime: "18:00", // 8 hours = 1.0 duration multiplier
        setupTimeMinutes: 0,
        distanceFromBase: 0,
        selectedCars: [],
      })

      // Track price = 100 * 1.0 * 1.0 = 100
      // Subtotal = 100
      // Tax = 100 * 0.08 = 8
      expect(result.dayMultiplier).toBe(1.0)
      expect(result.durationMultiplier).toBe(1.0)
      expect(result.subtotal).toBe(100)
      expect(result.tax).toBe(8)
    })

    it("returns setupFee as 0 (not charged to customer)", () => {
      const result = calculatePricing({
        trackBasePrice: 100,
        eventDate: new Date(Date.UTC(2025, 0, 6)),
        startTime: "10:00",
        endTime: "12:00",
        setupTimeMinutes: 90, // Would be $100 if charged
        distanceFromBase: 0,
        selectedCars: [],
      })

      expect(result.setupFee).toBe(0)
    })
  })
})

