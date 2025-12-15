import { describe, it, expect } from "vitest"
import { calculateBreakEven } from "@/lib/pricing/break-even"

describe("calculateBreakEven - edge cases", () => {
  it("handles zero setup time minutes", () => {
    const result = calculateBreakEven(200, 1000, 0, 0, {
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

    expect(result).not.toBeNull()
    expect(result?.laborCost).toBe(10) // Only breakdown time
  })

  it("handles zero breakdown time hours", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      laborRatePerHour: 10,
      breakdownTimeHours: 0,
      averageDistanceMiles: 10,
      fuelCostPerMile: 1,
      apiEmailCosts: 1,
      stripeFeeRate: 0.1,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.laborCost).toBe(10) // Only setup time (60 minutes = 1 hour)
  })

  it("handles zero labor rate", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      laborRatePerHour: 0,
      breakdownTimeHours: 1,
      averageDistanceMiles: 10,
      fuelCostPerMile: 1,
      apiEmailCosts: 1,
      stripeFeeRate: 0.1,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.laborCost).toBe(0)
  })

  it("handles very large setup time", () => {
    const result = calculateBreakEven(200, 1000, 600, 0, {
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

    expect(result).not.toBeNull()
    expect(result?.laborCost).toBe(110) // 10 hours setup + 1 hour breakdown
  })

  it("handles zero car costs", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
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

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(100) // Only track cost
  })

  it("handles negative car costs", () => {
    const result = calculateBreakEven(200, 1000, 60, -100, {
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

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(90) // 1000 - 100 = 900 / 10
  })

  it("handles zero expected rentals", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 0,
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

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(Infinity)
  })

  it("handles zero monthly rentals target", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 0,
      laborRatePerHour: 10,
      breakdownTimeHours: 1,
      averageDistanceMiles: 10,
      fuelCostPerMile: 1,
      apiEmailCosts: 1,
      stripeFeeRate: 0.1,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.monthlyCostPerRental).toBe(Infinity)
  })

  it("handles zero monthly recurring costs", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 0,
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

    expect(result).not.toBeNull()
    expect(result?.monthlyCostPerRental).toBe(0)
  })

  it("handles zero distance miles", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      laborRatePerHour: 10,
      breakdownTimeHours: 1,
      averageDistanceMiles: 0,
      fuelCostPerMile: 1,
      apiEmailCosts: 1,
      stripeFeeRate: 0.1,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.distanceCost).toBe(0)
  })

  it("handles zero fuel cost per mile", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      laborRatePerHour: 10,
      breakdownTimeHours: 1,
      averageDistanceMiles: 10,
      fuelCostPerMile: 0,
      apiEmailCosts: 1,
      stripeFeeRate: 0.1,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.distanceCost).toBe(0)
  })

  it("handles zero API email costs", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      laborRatePerHour: 10,
      breakdownTimeHours: 1,
      averageDistanceMiles: 10,
      fuelCostPerMile: 1,
      apiEmailCosts: 0,
      stripeFeeRate: 0.1,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.totalVariableCosts).toBeGreaterThan(0)
  })

  it("handles undefined battery costs", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
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
      // batteryCosts not provided
    })

    expect(result).not.toBeNull()
    expect(result?.batteryCosts).toBeUndefined()
  })

  it("handles very small unit cost", () => {
    const result = calculateBreakEven(200, 0.01, 60, 0, {
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

    expect(result).not.toBeNull()
    // 0.01 / 10 = 0.001, but rounding to 2 decimals gives 0.00
    // The function rounds to 2 decimal places
    expect(result?.fixedCostAmortization).toBe(0)
  })

  it("handles very large unit cost", () => {
    const result = calculateBreakEven(200, 1000000, 60, 0, {
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

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(100000)
  })

  it("handles negative base price", () => {
    const result = calculateBreakEven(-100, 1000, 60, 0, {
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

    expect(result).not.toBeNull()
    expect(result?.revenuePerRental).toBe(-100)
    expect(result?.profitPerRental).toBeLessThan(0)
  })

  it("handles 100% Stripe fee rate", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      laborRatePerHour: 10,
      breakdownTimeHours: 1,
      averageDistanceMiles: 10,
      fuelCostPerMile: 1,
      apiEmailCosts: 1,
      stripeFeeRate: 1.0,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.stripeFee).toBe(200)
    expect(result?.netRevenue).toBe(0)
  })

  it("handles very high Stripe fee rate", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      laborRatePerHour: 10,
      breakdownTimeHours: 1,
      averageDistanceMiles: 10,
      fuelCostPerMile: 1,
      apiEmailCosts: 1,
      stripeFeeRate: 0.99,
      stripeFixedFee: 0,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.stripeFee).toBeCloseTo(198)
    expect(result?.netRevenue).toBeCloseTo(2)
  })

  it("handles break-even rentals when profit is exactly zero", () => {
    // Find break-even price first
    const tempResult = calculateBreakEven(200, 1000, 60, 0, {
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

    const breakEvenPrice = tempResult?.breakEvenPrice || 0
    const result = calculateBreakEven(breakEvenPrice, 1000, 60, 0, {
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

    expect(result?.profitPerRental).toBeCloseTo(0, 1)
    expect(result?.breakEvenRentals).toBe(Infinity)
  })

  it("handles payback period when profit is negative", () => {
    const result = calculateBreakEven(10, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 1000,
      monthlyRentalsTarget: 1,
      laborRatePerHour: 100,
      breakdownTimeHours: 10,
      averageDistanceMiles: 100,
      fuelCostPerMile: 1,
      apiEmailCosts: 10,
      stripeFeeRate: 0.1,
      stripeFixedFee: 1,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.profitPerRental).toBeLessThan(0)
    expect(result?.paybackPeriodRentals).toBe(Infinity)
  })

  it("handles ROI when profit is negative", () => {
    const result = calculateBreakEven(10, 1000, 60, 0, {
      expectedRentals: 10,
      monthlyRecurringCosts: 1000,
      monthlyRentalsTarget: 1,
      laborRatePerHour: 100,
      breakdownTimeHours: 10,
      averageDistanceMiles: 100,
      fuelCostPerMile: 1,
      apiEmailCosts: 10,
      stripeFeeRate: 0.1,
      stripeFixedFee: 1,
      batteryCosts: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.roi).toBe(-100)
  })

  it("handles ROI when profit is positive", () => {
    const result = calculateBreakEven(5000, 1000, 60, 0, {
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

    expect(result).not.toBeNull()
    expect(result?.roi).toBeGreaterThan(0)
    expect(result?.paybackPeriodRentals).toBeGreaterThan(0)
  })

  it("handles partial config override", () => {
    const result = calculateBreakEven(200, 1000, 60, 0, {
      expectedRentals: 20, // Override default
      // Other values use defaults
    })

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(50) // 1000 / 20
  })
})
