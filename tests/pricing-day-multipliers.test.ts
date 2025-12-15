import { describe, it, expect, beforeEach, vi } from "vitest"
import { getDayMultiplier, getAllDayMultipliers } from "@/lib/pricing/day-multipliers"

const mockPrisma = vi.hoisted(() => ({
  dayMultiplier: { findUnique: vi.fn(), findMany: vi.fn() } as any,
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("pricing/day-multipliers extended", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.dayMultiplier = { findUnique: vi.fn(), findMany: vi.fn() }
  })

  describe("getDayMultiplier", () => {
    it("returns default when database query throws", async () => {
      mockPrisma.dayMultiplier.findUnique.mockRejectedValue(new Error("db error"))

      const result = await getDayMultiplier(6)
      expect(result).toBe(1.5) // Saturday default
    })

    it("returns 1.0 for unknown day of week in defaults", async () => {
      mockPrisma.dayMultiplier.findUnique.mockResolvedValue(null)

      const result = await getDayMultiplier(7) // Invalid day
      expect(result).toBe(1.0)
    })
  })

  describe("getAllDayMultipliers", () => {
    it("returns defaults when database model is missing", async () => {
      const original = mockPrisma.dayMultiplier
      // @ts-expect-error - simulate prisma model not available
      mockPrisma.dayMultiplier = undefined

      const result = await getAllDayMultipliers()
      
      expect(result[0]).toBe(1.3) // Sunday
      expect(result[6]).toBe(1.5) // Saturday

      mockPrisma.dayMultiplier = original
    })

    it("returns defaults when database query throws", async () => {
      mockPrisma.dayMultiplier.findMany.mockRejectedValue(new Error("db error"))

      const result = await getAllDayMultipliers()
      
      expect(result[0]).toBe(1.3)
      expect(result[1]).toBe(1.0)
    })
  })
})

