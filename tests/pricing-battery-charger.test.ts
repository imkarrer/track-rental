import { describe, it, expect, beforeEach, vi } from "vitest"
import { calculateBatteryCosts } from "@/lib/pricing/battery-costs"
import { calculateChargerCosts } from "@/lib/pricing/charger-costs"

const mockPrisma = vi.hoisted(() => ({
  batteryBatch: { findMany: vi.fn() },
  charger: { findMany: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("pricing/battery-costs extended", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns zero costs when no battery batches exist", async () => {
    mockPrisma.batteryBatch.findMany.mockResolvedValue([])

    const result = await calculateBatteryCosts(2, "ROAD")

    expect(result.carBatteryCost).toBe(0)
    expect(result.transmitterBatteryCost).toBe(0)
    expect(result.totalBatteryCost).toBe(0)
    expect(result.batterySwapLaborCost).toBe(0)
    // Charging labor is still applied
    expect(result.chargingLaborCost).toBeCloseTo(3.33)
  })

  it("calculates disposable battery costs correctly", async () => {
    mockPrisma.batteryBatch.findMany.mockImplementation(async ({ where }: any) => {
      if (where.usage === "CAR") {
        return [
          {
            usage: "CAR",
            batteryType: "LITHIUM_DISPOSABLE",
            expectedRuntimeRoad: 30,
            expectedRuntimeOffroad: 20,
            purchaseCost: 40,
            quantity: 8, // $5 per battery
          },
        ]
      }
      return []
    })

    const result = await calculateBatteryCosts(1, "ROAD", 20)

    // 1 hour = 60 min, 30 min runtime = 2 changes
    // 4 batteries per car * 2 changes = 8 battery uses
    // Cost per battery = $40/8 = $5
    // 8 batteries * $5 = $40
    expect(result.carBatteryCost).toBe(40)
  })

  it("uses offroad runtime for OFFROAD category", async () => {
    mockPrisma.batteryBatch.findMany.mockImplementation(async ({ where }: any) => {
      if (where.usage === "CAR") {
        return [
          {
            usage: "CAR",
            batteryType: "LIION",
            expectedRuntimeRoad: 60,
            expectedRuntimeOffroad: 20, // Shorter offroad runtime
            purchaseCost: 100,
            quantity: 10,
            expectedCycles: 100,
          },
        ]
      }
      return []
    })

    const result = await calculateBatteryCosts(1, "OFFROAD")

    // 1 hour = 60 min, 20 min offroad runtime = 3 changes
    // vs 1 change for road (60 min runtime)
    expect(result.carBatteryCost).toBeGreaterThan(0)
  })

  it("handles missing expectedCycles by defaulting to 500", async () => {
    mockPrisma.batteryBatch.findMany.mockImplementation(async ({ where }: any) => {
      if (where.usage === "CAR") {
        return [
          {
            usage: "CAR",
            batteryType: "LIION",
            expectedRuntimeRoad: 30,
            purchaseCost: 500,
            quantity: 10,
            expectedCycles: null, // Should default to 500
          },
        ]
      }
      return []
    })

    const result = await calculateBatteryCosts(1, "ROAD")
    
    // Cost per cycle = ($500/10) / 500 = $0.10
    // 2 changes * 4 cars * $0.10 = $0.80
    expect(result.carBatteryCost).toBeCloseTo(0.8)
  })

  it("calculates transmitter battery costs for disposable type", async () => {
    mockPrisma.batteryBatch.findMany.mockImplementation(async ({ where }: any) => {
      if (where.usage === "TRANSMITTER") {
        return [
          {
            usage: "TRANSMITTER",
            batteryType: "ALKALINE",
            purchaseCost: 16,
            quantity: 16, // $1 per battery
          },
        ]
      }
      return []
    })

    const result = await calculateBatteryCosts(2, "ROAD")

    // Transmitter uses 1 set of 4 batteries per rental
    expect(result.transmitterBatteryCost).toBe(4)
  })

  it("calculates transmitter battery costs for rechargeable type", async () => {
    mockPrisma.batteryBatch.findMany.mockImplementation(async ({ where }: any) => {
      if (where.usage === "TRANSMITTER") {
        return [
          {
            usage: "TRANSMITTER",
            batteryType: "NIMH",
            purchaseCost: 100,
            quantity: 20,
            expectedCycles: 200,
          },
        ]
      }
      return []
    })

    const result = await calculateBatteryCosts(2, "ROAD")

    // Cost per cycle = ($100/20) / 200 = $0.025
    // 4 batteries * $0.025 = $0.10
    expect(result.transmitterBatteryCost).toBeCloseTo(0.1)
  })
})

describe("pricing/charger-costs extended", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns zero costs when no chargers exist", async () => {
    mockPrisma.charger.findMany.mockResolvedValue([])

    const result = await calculateChargerCosts()

    expect(result.carChargerCost).toBe(0)
    expect(result.transmitterChargerCost).toBe(0)
    expect(result.totalChargerCost).toBe(0)
  })

  it("handles missing expectedLifespanYears by defaulting to 5", async () => {
    mockPrisma.charger.findMany.mockResolvedValue([
      {
        id: "c1",
        batteryType: "LIION",
        purchaseCost: 240,
        expectedLifespanYears: null,
        isActive: true,
      },
    ])

    const result = await calculateChargerCosts(4) // 4 rentals per month

    // Total rentals = 4 * 12 * 5 = 240
    // Cost = $240 / 240 = $1.00
    expect(result.carChargerCost).toBe(1)
  })

  it("falls back to first charger when specific types not found", async () => {
    mockPrisma.charger.findMany.mockResolvedValue([
      {
        id: "c1",
        batteryType: "OTHER",
        purchaseCost: 48,
        expectedLifespanYears: 4,
        isActive: true,
      },
    ])

    const result = await calculateChargerCosts()

    // Both car and transmitter use the same fallback charger
    // Total rentals = 4 * 12 * 4 = 192
    // Cost = $48 / 192 = $0.25
    expect(result.carChargerCost).toBe(0.25)
    expect(result.transmitterChargerCost).toBe(0.25)
  })
})

