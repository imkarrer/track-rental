import { describe, it, expect, beforeEach, vi } from "vitest"
import { calculateBatteryCosts } from "@/lib/pricing/battery-costs"
import { calculateChargerCosts } from "@/lib/pricing/charger-costs"
import { getDayMultiplier, getAllDayMultipliers } from "@/lib/pricing/day-multipliers"
import { getFixedCostsConfig } from "@/lib/pricing/fixed-costs"

const mockPrisma = vi.hoisted(() => ({
  batteryBatch: { findMany: vi.fn() },
  charger: { findMany: vi.fn() },
  dayMultiplier: { findUnique: vi.fn(), findMany: vi.fn() } as any,
  fixedCostsConfig: { findFirst: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("pricing cost helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.dayMultiplier = { findUnique: vi.fn(), findMany: vi.fn() }
  })

  it("calculates battery costs for mixed battery types", async () => {
    mockPrisma.batteryBatch.findMany.mockImplementation(async ({ where }: any) => {
      if (where.usage === "CAR") {
        return [
          {
            usage: "CAR",
            batteryType: "LIION",
            expectedRuntimeRoad: 30,
            expectedRuntimeOffroad: 20,
            purchaseCost: 100,
            quantity: 10,
            expectedCycles: 100,
          },
        ]
      }
      return [
        {
          usage: "TRANSMITTER",
          batteryType: "ALKALINE",
          purchaseCost: 20,
          quantity: 20,
        },
      ]
    })

    const result = await calculateBatteryCosts(2, "ROAD", 20)

    expect(result.carBatteryCost).toBeCloseTo(1.6)
    expect(result.transmitterBatteryCost).toBeCloseTo(4)
    expect(result.batterySwapLaborCost).toBeCloseTo(5.33)
    expect(result.totalCost).toBeCloseTo(14.27)
  })

  it("calculates charger amortization per rental", async () => {
    mockPrisma.charger.findMany.mockResolvedValue([
      { id: "c1", batteryType: "LIION", purchaseCost: 120, expectedLifespanYears: 4, isActive: true },
      { id: "c2", batteryType: "NIMH", purchaseCost: 60, expectedLifespanYears: 5, isActive: true },
    ])

    const result = await calculateChargerCosts()

    expect(result.carChargerCost).toBeCloseTo(0.63)
    expect(result.transmitterChargerCost).toBeCloseTo(0.25)
    expect(result.totalChargerCost).toBeCloseTo(0.88)
  })

  it("returns default multipliers when database model is missing", async () => {
    const original = mockPrisma.dayMultiplier
    // @ts-expect-error - simulate prisma extension not available
    delete mockPrisma.dayMultiplier

    const multiplier = await getDayMultiplier(1) // Monday
    expect(multiplier).toBe(1.0)

    // Restore for subsequent tests
    mockPrisma.dayMultiplier = original
  })

  it("prefers configured multipliers and falls back when not found", async () => {
    mockPrisma.dayMultiplier.findUnique.mockResolvedValueOnce({ dayOfWeek: 5, multiplier: 1.4 }) // Friday override
    const friday = await getDayMultiplier(5)
    expect(friday).toBe(1.4)

    mockPrisma.dayMultiplier.findUnique.mockResolvedValueOnce(null)
    const thursday = await getDayMultiplier(4)
    expect(thursday).toBe(1.0)
  })

  it("merges all day multipliers with defaults", async () => {
    mockPrisma.dayMultiplier.findMany.mockResolvedValue([
      { dayOfWeek: 0, multiplier: 1.5 },
      { dayOfWeek: 2, multiplier: 1.1 },
    ])

    const result = await getAllDayMultipliers()

    expect(result[0]).toBe(1.5)
    expect(result[2]).toBe(1.1)
    expect(result[6]).toBe(1.5) // default Saturday
  })

  it("returns configured fixed costs from the database", async () => {
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

    expect(config.monthlyRecurringCosts).toBe(40)
    expect(config.monthlyRentalsTarget).toBe(5)
    expect(config.laborRatePerHour).toBe(25)
    expect(config.breakdownTimeHours).toBe(2)
    expect(config.averageDistanceMiles).toBe(30)
    expect(config.stripeFeeRate).toBe(0.03)
    expect(config.stripeFixedFee).toBe(0.5)
  })

  it("falls back to defaults when fetching fixed costs fails", async () => {
    mockPrisma.fixedCostsConfig.findFirst.mockRejectedValue(new Error("db unavailable"))

    const config = await getFixedCostsConfig()

    expect(config.unitCost).toBe(2000)
    expect(config.monthlyRecurringCosts).toBeCloseTo(89.67)
    expect(config.monthlyRentalsTarget).toBe(4)
    expect(config.laborRatePerHour).toBe(20)
  })
})


