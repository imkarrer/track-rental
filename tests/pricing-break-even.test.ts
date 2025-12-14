import { describe, it, expect } from "vitest"
import { calculateBreakEven } from "@/lib/pricing/break-even"
import { calculateCarBreakEven } from "@/lib/pricing/car-break-even"

describe("calculateBreakEven", () => {
  it("returns null when unit cost is missing or zero", () => {
    expect(calculateBreakEven(200, null, 60)).toBeNull()
    expect(calculateBreakEven(200, 0, 60)).toBeNull()
  })

  it("computes break-even metrics with custom config", () => {
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
    expect(result?.fixedCostAmortization).toBe(100)
    expect(result?.monthlyCostPerRental).toBe(50)
    expect(result?.laborCost).toBe(20)
    expect(result?.distanceCost).toBe(10)
    expect(result?.breakEvenRevenue).toBeCloseTo(201.11)
    expect(result?.profitPerRental).toBeCloseTo(-1)
    expect(result?.profitMargin).toBeCloseTo(-0.5)
    expect(result?.breakEvenRentals).toBe(Infinity)
  })
})

describe("calculateCarBreakEven", () => {
  it("returns null when unit cost is missing", () => {
    expect(calculateCarBreakEven(100, null, {})).toBeNull()
  })

  it("computes ROI and break-even data for cars", () => {
    const result = calculateCarBreakEven(200, 400, {
      expectedRentals: 4,
      monthlyRecurringCosts: 100,
      monthlyRentalsTarget: 2,
      averageDistanceMiles: 8,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 1,
      stripeFeeRate: 0.05,
      stripeFixedFee: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.fixedCostAmortization).toBe(100)
    expect(result?.monthlyCostPerRental).toBeCloseTo(12.5)
    expect(result?.distanceCost).toBeCloseTo(1)
    expect(result?.breakEvenPricePerDay).toBeCloseTo(120.53)
    expect(result?.profitPerRental).toBeCloseTo(75.5)
    expect(result?.breakEvenRentals).toBe(6)
    expect(result?.roi).toBeCloseTo(-24.5)
  })
})


