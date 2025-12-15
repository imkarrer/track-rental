import { describe, it, expect } from "vitest"
import { calculateBreakEven } from "@/lib/pricing/break-even"
import { calculateCarBreakEven } from "@/lib/pricing/car-break-even"

describe("pricing/break-even extended coverage", () => {
  describe("calculateBreakEven", () => {
    it("includes battery costs in calculation when provided", () => {
      const resultWithBattery = calculateBreakEven(200, 1000, 60, 0, {
        expectedRentals: 10,
        monthlyRecurringCosts: 100,
        monthlyRentalsTarget: 2,
        laborRatePerHour: 10,
        breakdownTimeHours: 1,
        averageDistanceMiles: 10,
        fuelCostPerMile: 1,
        apiEmailCosts: 1,
        stripeFeeRate: 0.1,
        stripeFixedFee: 0,
        batteryCosts: 10, // Added battery costs
      })

      const resultWithoutBattery = calculateBreakEven(200, 1000, 60, 0, {
        expectedRentals: 10,
        monthlyRecurringCosts: 100,
        monthlyRentalsTarget: 2,
        laborRatePerHour: 10,
        breakdownTimeHours: 1,
        averageDistanceMiles: 10,
        fuelCostPerMile: 1,
        apiEmailCosts: 1,
        stripeFeeRate: 0.1,
        stripeFixedFee: 0,
        batteryCosts: 0,
      })

      expect(resultWithBattery?.batteryCosts).toBe(10)
      expect(resultWithBattery?.totalVariableCosts).toBe(resultWithoutBattery!.totalVariableCosts + 10)
    })

    it("includes car costs in fixed cost amortization", () => {
      const result = calculateBreakEven(200, 1000, 60, 500, {
        expectedRentals: 10,
        monthlyRecurringCosts: 0,
        monthlyRentalsTarget: 1,
        laborRatePerHour: 0,
        breakdownTimeHours: 0,
        averageDistanceMiles: 0,
        fuelCostPerMile: 0,
        apiEmailCosts: 0,
        stripeFeeRate: 0,
        stripeFixedFee: 0,
        batteryCosts: 0,
      })

      // Fixed cost = (1000 + 500) / 10 = 150
      expect(result?.fixedCostAmortization).toBe(150)
    })

    it("calculates negative ROI when profit is zero or negative", () => {
      const result = calculateBreakEven(50, 1000, 60, 0, {
        expectedRentals: 10,
        monthlyRecurringCosts: 100,
        monthlyRentalsTarget: 2,
        laborRatePerHour: 20,
        breakdownTimeHours: 1,
        averageDistanceMiles: 20,
        fuelCostPerMile: 1,
        apiEmailCosts: 10,
        stripeFeeRate: 0.1,
        stripeFixedFee: 1,
        batteryCosts: 0,
      })

      expect(result?.roi).toBe(-100)
      expect(result?.paybackPeriodRentals).toBe(Infinity)
    })

    it("handles zero base price correctly", () => {
      const result = calculateBreakEven(0, 1000, 60, 0, {
        expectedRentals: 10,
        monthlyRecurringCosts: 50,
        monthlyRentalsTarget: 2,
        laborRatePerHour: 10,
        breakdownTimeHours: 1,
        averageDistanceMiles: 10,
        fuelCostPerMile: 0.5,
        apiEmailCosts: 0.1,
        stripeFeeRate: 0.029,
        stripeFixedFee: 0.3,
        batteryCosts: 0,
      })

      expect(result?.profitMargin).toBe(0)
      expect(result?.revenuePerRental).toBe(0)
    })
  })

  describe("calculateCarBreakEven", () => {
    it("returns null for zero unit cost", () => {
      expect(calculateCarBreakEven(100, 0)).toBeNull()
    })

    it("returns null for negative unit cost", () => {
      expect(calculateCarBreakEven(100, -500)).toBeNull()
    })

    it("calculates positive ROI for profitable pricing", () => {
      const result = calculateCarBreakEven(500, 200, {
        expectedRentals: 20,
        monthlyRecurringCosts: 40,
        monthlyRentalsTarget: 4,
        averageDistanceMiles: 10,
        fuelCostPerMile: 0.5,
        apiEmailCosts: 0.1,
        stripeFeeRate: 0.029,
        stripeFixedFee: 0.3,
      })

      expect(result?.profitPerRental).toBeGreaterThan(0)
      expect(result?.roi).toBeGreaterThan(0)
    })

    it("handles Infinity payback period when profit is negative", () => {
      const result = calculateCarBreakEven(10, 1000, {
        expectedRentals: 10,
        monthlyRecurringCosts: 400,
        monthlyRentalsTarget: 2,
        averageDistanceMiles: 100,
        fuelCostPerMile: 1,
        apiEmailCosts: 5,
        stripeFeeRate: 0.1,
        stripeFixedFee: 1,
      })

      expect(result?.paybackPeriodRentals).toBe(Infinity)
      expect(result?.breakEvenRentals).toBe(Infinity)
    })
  })
})

