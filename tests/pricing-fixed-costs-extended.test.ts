import { describe, it, expect, beforeEach, vi } from "vitest"
import { getFixedCostsConfig } from "@/lib/pricing/fixed-costs"

const mockPrisma = vi.hoisted(() => ({
  fixedCostsConfig: { findFirst: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("getFixedCostsConfig - extended edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("handles null config from database", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue(null)

    const config = await getFixedCostsConfig()

    expect(config.unitCost).toBe(2000)
    expect(config.monthlyRecurringCosts).toBeCloseTo(89.67)
    expect(config.monthlyRentalsTarget).toBe(4)
    expect(config.laborRatePerHour).toBe(20)
  })

  it("handles partial config from database", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      // Missing other fields - should use defaults where appropriate
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.expectedRentals).toBe(50)
    expect(config.monthlyRentalsTarget).toBe(5)
    expect(config.monthlyRecurringCosts).toBe(40) // Sum of monthly costs
    expect(config.laborRatePerHour).toBe(25)
    expect(config.breakdownTimeHours).toBe(2)
  })

  it("handles zero monthly costs", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 0,
      databaseMonthly: 0,
      emailServiceMonthly: 0,
      domainMonthly: 0,
      insuranceMonthly: 0,
    })

    const config = await getFixedCostsConfig()

    expect(config.monthlyRecurringCosts).toBe(0)
  })

  it("handles negative monthly costs", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: -10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    // Should still sum correctly (negative + positive)
    expect(config.monthlyRecurringCosts).toBe(20)
  })

  it("handles very large monthly costs", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 1000,
      databaseMonthly: 2000,
      emailServiceMonthly: 500,
      domainMonthly: 100,
      insuranceMonthly: 1500,
    })

    const config = await getFixedCostsConfig()

    expect(config.monthlyRecurringCosts).toBe(5100)
  })

  it("handles zero expected rentals", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 0,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.expectedRentals).toBe(0)
  })

  it("handles zero monthly rentals target", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 0,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.monthlyRentalsTarget).toBe(0)
  })

  it("handles zero labor rate", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 0,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.laborRatePerHour).toBe(0)
  })

  it("handles zero breakdown time hours", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 0,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.breakdownTimeHours).toBe(0)
  })

  it("handles zero distance miles", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 0,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.averageDistanceMiles).toBe(0)
  })

  it("handles zero fuel cost per mile", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.fuelCostPerMile).toBe(0)
  })

  it("handles zero API email costs", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.apiEmailCosts).toBe(0)
  })

  it("handles zero Stripe fee rate", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.stripeFeeRate).toBe(0)
  })

  it("handles zero Stripe fixed fee", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    expect(config.stripeFixedFee).toBe(0)
  })

  it("preserves track-specific defaults when config exists", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    // Track-specific values should use defaults, not from config
    expect(config.unitCost).toBe(2000) // Default
    expect(config.carCosts).toBe(0) // Default
    expect(config.setupTimeHours).toBe(1) // Default
    expect(config.batteryCosts).toBe(0) // Default
  })

  it("handles database error gracefully", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockRejectedValue(new Error("Connection timeout"))

    const config = await getFixedCostsConfig()

    // Should return defaults on error
    expect(config.unitCost).toBe(2000)
    expect(config.monthlyRecurringCosts).toBeCloseTo(89.67)
    expect(config.monthlyRentalsTarget).toBe(4)
  })

  it("handles network error gracefully", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockRejectedValue(new Error("Network error"))

    const config = await getFixedCostsConfig()

    expect(config.unitCost).toBe(2000)
    expect(config.monthlyRecurringCosts).toBeCloseTo(89.67)
  })

  it("handles invalid data types gracefully", async () => {
    // Simulate database returning invalid data
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: "invalid",
      monthlyRentalsTarget: null,
      laborRatePerHour: undefined,
      breakdownTimeHours: "2",
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10,
      databaseMonthly: 15,
      emailServiceMonthly: 5,
      domainMonthly: 2,
      insuranceMonthly: 8,
    })

    const config = await getFixedCostsConfig()

    // expectedRentals is not converted with Number(), so it remains as-is from database
    // Other fields like laborRatePerHour use Number() conversion
    expect(config).toBeDefined()
    // expectedRentals will be a string if database returns a string
    expect(typeof config.expectedRentals).toBe("string")
    expect(config.expectedRentals).toBe("invalid")
    // Other fields that use Number() conversion will be numbers
    expect(typeof config.laborRatePerHour).toBe("number")
    expect(isNaN(config.laborRatePerHour)).toBe(true) // undefined -> NaN
    expect(typeof config.breakdownTimeHours).toBe("number")
    expect(config.breakdownTimeHours).toBe(2) // "2" -> 2
  })

  it("calculates total monthly recurring costs correctly", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockResolvedValue({
      expectedRentals: 50,
      monthlyRentalsTarget: 5,
      laborRatePerHour: 25,
      breakdownTimeHours: 2,
      averageDistanceMiles: 30,
      fuelCostPerMile: 0.7,
      apiEmailCosts: 0.5,
      stripeFeeRate: 0.03,
      stripeFixedFee: 0.5,
      serverHostingMonthly: 10.5,
      databaseMonthly: 15.25,
      emailServiceMonthly: 5.75,
      domainMonthly: 2.1,
      insuranceMonthly: 8.9,
    })

    const config = await getFixedCostsConfig()

    expect(config.monthlyRecurringCosts).toBeCloseTo(42.5, 1)
  })
})
