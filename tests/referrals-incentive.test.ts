import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getReferralIncentive,
  setReferralIncentive,
  computeReferralDiscount,
  ReferralIncentiveConfig,
} from "@/lib/referrals/incentive"

const mockPrisma = vi.hoisted(() => ({
  referralIncentive: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("referrals/incentive", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getReferralIncentive", () => {
    it("returns configured incentive when available", async () => {
      mockPrisma.referralIncentive.findUnique.mockResolvedValue({
        id: "default",
        type: "FLAT",
        percentOff: null,
        amountOff: 25,
        applyOnce: false,
      })

      const result = await getReferralIncentive()
      expect(result).toEqual({
        type: "FLAT",
        percentOff: undefined,
        amountOff: 25,
        applyOnce: false,
      })
    })

    it("returns default incentive when not found", async () => {
      mockPrisma.referralIncentive.findUnique.mockResolvedValue(null)

      const result = await getReferralIncentive()
      expect(result).toEqual({
        type: "PERCENT",
        percentOff: 10,
        applyOnce: true,
      })
    })

    it("handles percent incentive type correctly", async () => {
      mockPrisma.referralIncentive.findUnique.mockResolvedValue({
        id: "default",
        type: "PERCENT",
        percentOff: 15,
        amountOff: null,
        applyOnce: true,
      })

      const result = await getReferralIncentive()
      expect(result.type).toBe("PERCENT")
      expect(result.percentOff).toBe(15)
    })
  })

  describe("setReferralIncentive", () => {
    it("upserts percent incentive config", async () => {
      const config: ReferralIncentiveConfig = {
        type: "PERCENT",
        percentOff: 20,
        applyOnce: true,
      }

      await setReferralIncentive(config)

      expect(mockPrisma.referralIncentive.upsert).toHaveBeenCalledWith({
        where: { id: "default" },
        update: {
          type: "PERCENT",
          percentOff: 20,
          amountOff: null,
          applyOnce: true,
        },
        create: {
          id: "default",
          type: "PERCENT",
          percentOff: 20,
          amountOff: null,
          applyOnce: true,
        },
      })
    })

    it("upserts flat incentive config", async () => {
      const config: ReferralIncentiveConfig = {
        type: "FLAT",
        amountOff: 50,
        applyOnce: false,
      }

      await setReferralIncentive(config)

      expect(mockPrisma.referralIncentive.upsert).toHaveBeenCalledWith({
        where: { id: "default" },
        update: {
          type: "FLAT",
          percentOff: null,
          amountOff: 50,
          applyOnce: false,
        },
        create: {
          id: "default",
          type: "FLAT",
          percentOff: null,
          amountOff: 50,
          applyOnce: false,
        },
      })
    })
  })

  describe("computeReferralDiscount", () => {
    it("returns 0 for zero or negative total", () => {
      const percentConfig: ReferralIncentiveConfig = { type: "PERCENT", percentOff: 10, applyOnce: true }
      expect(computeReferralDiscount(0, percentConfig)).toBe(0)
      expect(computeReferralDiscount(-100, percentConfig)).toBe(0)
    })

    it("computes percent discount correctly", () => {
      const config: ReferralIncentiveConfig = { type: "PERCENT", percentOff: 10, applyOnce: true }
      expect(computeReferralDiscount(100, config)).toBe(10)
      expect(computeReferralDiscount(250, config)).toBe(25)
    })

    it("caps percent at 100", () => {
      const config: ReferralIncentiveConfig = { type: "PERCENT", percentOff: 150, applyOnce: true }
      expect(computeReferralDiscount(100, config)).toBe(100)
    })

    it("handles negative percent as 0", () => {
      const config: ReferralIncentiveConfig = { type: "PERCENT", percentOff: -10, applyOnce: true }
      expect(computeReferralDiscount(100, config)).toBe(0)
    })

    it("computes flat discount correctly", () => {
      const config: ReferralIncentiveConfig = { type: "FLAT", amountOff: 25, applyOnce: true }
      expect(computeReferralDiscount(100, config)).toBe(25)
      expect(computeReferralDiscount(200, config)).toBe(25)
    })

    it("caps flat discount at total amount", () => {
      const config: ReferralIncentiveConfig = { type: "FLAT", amountOff: 50, applyOnce: true }
      expect(computeReferralDiscount(30, config)).toBe(30)
    })

    it("handles negative amount as 0", () => {
      const config: ReferralIncentiveConfig = { type: "FLAT", amountOff: -10, applyOnce: true }
      expect(computeReferralDiscount(100, config)).toBe(0)
    })

    it("handles undefined percentOff as 0", () => {
      const config: ReferralIncentiveConfig = { type: "PERCENT", applyOnce: true }
      expect(computeReferralDiscount(100, config)).toBe(0)
    })

    it("handles undefined amountOff as 0", () => {
      const config: ReferralIncentiveConfig = { type: "FLAT", applyOnce: true }
      expect(computeReferralDiscount(100, config)).toBe(0)
    })
  })
})

