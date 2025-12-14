import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getProgramConfigs,
  setProgramConfigs,
  computeDiscount,
  ProgramId,
  ProgramConfig,
} from "@/lib/referrals/program-config"

const mockPrisma = vi.hoisted(() => ({
  referralProgramConfig: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("referrals/program-config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getProgramConfigs", () => {
    it("returns defaults when database model is not available", async () => {
      const original = mockPrisma.referralProgramConfig
      // @ts-expect-error - simulate prisma model not available
      mockPrisma.referralProgramConfig = undefined

      const result = await getProgramConfigs()
      
      expect(result.user.id).toBe("user")
      expect(result.user.enabled).toBe(true)
      expect(result.user.refereePercentOff).toBe(10)
      expect(result.admin.id).toBe("admin")
      expect(result.admin.refereePercentOff).toBe(15)

      mockPrisma.referralProgramConfig = original
    })

    it("returns defaults when database is empty", async () => {
      mockPrisma.referralProgramConfig.findMany.mockResolvedValue([])

      const result = await getProgramConfigs()
      
      expect(result.user.referrerPercentOff).toBe(5)
      expect(result.admin.referrerPercentOff).toBe(0) // Admin has no referrer incentive
    })

    it("merges database config with defaults", async () => {
      mockPrisma.referralProgramConfig.findMany.mockResolvedValue([
        {
          id: "user",
          enabled: true,
          referrerType: "FLAT",
          referrerPercentOff: null,
          referrerAmountOff: 20,
          referrerApplyOnce: false,
          refereeType: "PERCENT",
          refereePercentOff: 15,
          refereeAmountOff: null,
          refereeApplyOnce: true,
        },
      ])

      const result = await getProgramConfigs()
      
      expect(result.user.referrerType).toBe("FLAT")
      expect(result.user.referrerAmountOff).toBe(20)
      expect(result.user.refereePercentOff).toBe(15)
      // User referrerApplyOnce is always forced to false
      expect(result.user.referrerApplyOnce).toBe(false)
    })

    it("forces admin referrer values to 0", async () => {
      mockPrisma.referralProgramConfig.findMany.mockResolvedValue([
        {
          id: "admin",
          enabled: true,
          referrerType: "FLAT",
          referrerPercentOff: 50,
          referrerAmountOff: 100,
          referrerApplyOnce: true,
          refereeType: "PERCENT",
          refereePercentOff: 20,
          refereeAmountOff: null,
          refereeApplyOnce: true,
        },
      ])

      const result = await getProgramConfigs()
      
      // Admin referrer incentives are forced to 0
      expect(result.admin.referrerPercentOff).toBe(0)
      expect(result.admin.referrerAmountOff).toBe(0)
      expect(result.admin.referrerApplyOnce).toBe(false)
      // Referee settings are preserved
      expect(result.admin.refereePercentOff).toBe(20)
    })

    it("returns defaults on database error", async () => {
      mockPrisma.referralProgramConfig.findMany.mockRejectedValue(new Error("db error"))

      const result = await getProgramConfigs()
      
      expect(result.user.enabled).toBe(true)
      expect(result.admin.enabled).toBe(true)
    })
  })

  describe("setProgramConfigs", () => {
    it("throws when database model is not available", async () => {
      const original = mockPrisma.referralProgramConfig
      // @ts-expect-error - simulate prisma model not available
      mockPrisma.referralProgramConfig = undefined

      const configs: Record<ProgramId, ProgramConfig> = {
        user: {
          id: "user",
          enabled: true,
          referrerType: "PERCENT",
          referrerPercentOff: 5,
          referrerApplyOnce: false,
          refereeType: "PERCENT",
          refereePercentOff: 10,
          refereeApplyOnce: true,
        },
        admin: {
          id: "admin",
          enabled: true,
          referrerType: "PERCENT",
          referrerPercentOff: 0,
          referrerApplyOnce: false,
          refereeType: "PERCENT",
          refereePercentOff: 15,
          refereeApplyOnce: true,
        },
      }

      await expect(setProgramConfigs(configs)).rejects.toThrow("ReferralProgramConfig model not available")

      mockPrisma.referralProgramConfig = original
    })

    it("upserts program configs with forced values", async () => {
      mockPrisma.referralProgramConfig.upsert.mockResolvedValue({})

      const configs: Record<ProgramId, ProgramConfig> = {
        user: {
          id: "user",
          enabled: true,
          referrerType: "PERCENT",
          referrerPercentOff: 10,
          referrerApplyOnce: true, // Should be forced to false
          refereeType: "PERCENT",
          refereePercentOff: 15,
          refereeApplyOnce: true,
        },
        admin: {
          id: "admin",
          enabled: true,
          referrerType: "PERCENT",
          referrerPercentOff: 50, // Should be forced to 0
          referrerApplyOnce: true, // Should be forced to false
          refereeType: "PERCENT",
          refereePercentOff: 20,
          refereeApplyOnce: false,
        },
      }

      await setProgramConfigs(configs)

      expect(mockPrisma.referralProgramConfig.upsert).toHaveBeenCalledTimes(2)
      
      // Check user config - referrerApplyOnce forced to false
      const userCall = mockPrisma.referralProgramConfig.upsert.mock.calls.find(
        (call: any) => call[0].where.id === "user"
      )
      expect(userCall[0].update.referrerApplyOnce).toBe(false)
      
      // Check admin config - referrer values forced to 0
      const adminCall = mockPrisma.referralProgramConfig.upsert.mock.calls.find(
        (call: any) => call[0].where.id === "admin"
      )
      expect(adminCall[0].update.referrerPercentOff).toBe(0)
      expect(adminCall[0].update.referrerAmountOff).toBe(0)
      expect(adminCall[0].update.referrerApplyOnce).toBe(false)
    })
  })

  describe("computeDiscount", () => {
    it("returns 0 for zero or negative total", () => {
      expect(computeDiscount(0, "PERCENT", 10)).toBe(0)
      expect(computeDiscount(-50, "PERCENT", 10)).toBe(0)
      expect(computeDiscount(0, "FLAT", undefined, 25)).toBe(0)
    })

    it("computes percent discount correctly", () => {
      expect(computeDiscount(100, "PERCENT", 10)).toBe(10)
      expect(computeDiscount(200, "PERCENT", 25)).toBe(50)
    })

    it("caps percent at 100", () => {
      expect(computeDiscount(100, "PERCENT", 150)).toBe(100)
    })

    it("handles negative percent as 0", () => {
      expect(computeDiscount(100, "PERCENT", -10)).toBe(0)
    })

    it("computes flat discount correctly", () => {
      expect(computeDiscount(100, "FLAT", undefined, 25)).toBe(25)
      expect(computeDiscount(200, "FLAT", undefined, 50)).toBe(50)
    })

    it("caps flat discount at total amount", () => {
      expect(computeDiscount(20, "FLAT", undefined, 50)).toBe(20)
    })

    it("handles negative amount as 0", () => {
      expect(computeDiscount(100, "FLAT", undefined, -10)).toBe(0)
    })

    it("handles undefined percent as 0", () => {
      expect(computeDiscount(100, "PERCENT", undefined)).toBe(0)
    })

    it("handles undefined amount as 0", () => {
      expect(computeDiscount(100, "FLAT", undefined, undefined)).toBe(0)
    })
  })
})

