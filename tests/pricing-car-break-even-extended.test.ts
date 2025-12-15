import { describe, it, expect } from "vitest"
import { calculateCarBreakEven } from "@/lib/pricing/car-break-even"

describe("calculateCarBreakEven - extended edge cases", () => {
  it("handles zero expected rentals", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 0,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    // Should handle division by zero gracefully
    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(Infinity)
  })

  it("handles zero monthly rentals target", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 0,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.monthlyCostPerRental).toBe(Infinity)
  })

  it("handles very small unit cost", () => {
    const result = calculateCarBreakEven(200, 0.01, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBeCloseTo(0.001)
  })

  it("handles very large unit cost", () => {
    const result = calculateCarBreakEven(200, 1000000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(100000)
    expect(result?.breakEvenRentals).toBeGreaterThan(0)
  })

  it("handles zero base price", () => {
    const result = calculateCarBreakEven(0, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.revenuePerRental).toBe(0)
    expect(result?.profitPerRental).toBeLessThan(0)
    expect(result?.profitMargin).toBe(0)
  })

  it("handles negative base price", () => {
    const result = calculateCarBreakEven(-100, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.revenuePerRental).toBe(-100)
    expect(result?.profitPerRental).toBeLessThan(0)
  })

  it("handles zero distance cost", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 0,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.distanceCost).toBe(0)
  })

  it("handles zero fuel cost per mile", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.distanceCost).toBe(0)
  })

  it("handles zero API email costs", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 0,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.totalVariableCosts).toBeGreaterThan(0)
  })

  it("handles zero Stripe fee rate", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.stripeFee).toBe(0)
    expect(result?.netRevenue).toBe(200)
  })

  it("handles 100% Stripe fee rate", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 1.0,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.stripeFee).toBe(200)
    expect(result?.netRevenue).toBe(0)
  })

  it("handles very high Stripe fee rate", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.99,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.stripeFee).toBeCloseTo(198)
    expect(result?.netRevenue).toBeCloseTo(2)
  })

  it("handles zero monthly recurring costs", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 0,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.monthlyCostPerRental).toBe(0)
  })

  it("calculates break-even rentals correctly when profit is exactly zero", () => {
    // Set price to exactly break-even
    const result = calculateCarBreakEven(120, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    // Adjust to find break-even point
    const breakEvenPrice = result?.breakEvenPricePerDay || 0
    const breakEvenResult = calculateCarBreakEven(breakEvenPrice, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(breakEvenResult?.profitPerRental).toBeCloseTo(0, 1)
  })

  it("handles all config options provided", () => {
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 15,
      monthlyRecurringCosts: 150,
      monthlyRentalsTarget: 5,
      averageDistanceMiles: 25,
      fuelCostPerMile: 0.6,
      apiEmailCosts: 2,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
    })

    expect(result).not.toBeNull()
    expect(result?.expectedRentals).toBeUndefined() // Not in result, but config is used
    expect(result?.fixedCostAmortization).toBeCloseTo(66.67, 1)
  })

  it("uses default expectedRentals when not provided", () => {
    const result = calculateCarBreakEven(200, 1000, {
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    // Default is 100, so fixedCostAmortization should be 1000/100 = 10
    expect(result?.fixedCostAmortization).toBe(10)
  })

  it("handles very small profit margin", () => {
    // Use a higher base price to ensure profit is positive
    const result = calculateCarBreakEven(200, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 50,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 5,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.profitPerRental).toBeGreaterThan(0)
    expect(result?.profitMargin).toBeGreaterThan(0)
    expect(result?.profitMargin).toBeLessThan(50)
  })

  it("handles very large profit margin", () => {
    const result = calculateCarBreakEven(10000, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.profitPerRental).toBeGreaterThan(9000)
    expect(result?.profitMargin).toBeGreaterThan(90)
  })

  it("handles break-even rentals calculation when profit is negative", () => {
    const result = calculateCarBreakEven(10, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 1000,
      monthlyRentalsTarget: 1,
      averageDistanceMiles: 100,
      fuelCostPerMile: 1,
      apiEmailCosts: 10,
      stripeFeeRate: 0.1,
      stripeFixedFee: 1,
    })

    expect(result).not.toBeNull()
    expect(result?.profitPerRental).toBeLessThan(0)
    expect(result?.breakEvenRentals).toBe(Infinity)
    expect(result?.paybackPeriodRentals).toBe(Infinity)
  })

  it("handles ROI calculation when profit is negative", () => {
    const result = calculateCarBreakEven(10, 1000, {
      expectedRentals: 10,
      monthlyRecurringCosts: 1000,
      monthlyRentalsTarget: 1,
      averageDistanceMiles: 100,
      fuelCostPerMile: 1,
      apiEmailCosts: 10,
      stripeFeeRate: 0.1,
      stripeFixedFee: 1,
    })

    expect(result).not.toBeNull()
    expect(result?.roi).toBe(-100)
  })

  it("handles ROI calculation when profit is positive", () => {
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

    expect(result).not.toBeNull()
    expect(result?.roi).toBeGreaterThan(0)
    expect(result?.paybackPeriodRentals).toBeGreaterThan(0)
    expect(result?.paybackPeriodRentals).toBeLessThan(result?.expectedRentals || Infinity)
  })
})
