import { describe, it, expect } from "vitest"
import { calculateRefundPercent } from "@/lib/booking/refund-calculator"

describe("booking/refund-calculator", () => {
  const defaultPolicies = [
    { daysBeforeService: 14, nonRefundablePercent: 0 },
    { daysBeforeService: 7, nonRefundablePercent: 25 },
    { daysBeforeService: 3, nonRefundablePercent: 50 },
    { daysBeforeService: 1, nonRefundablePercent: 75 },
    { daysBeforeService: 0, nonRefundablePercent: 100 },
  ]

  describe("calculateRefundPercent", () => {
    it("returns 0 for negative days (after service date)", () => {
      expect(calculateRefundPercent(defaultPolicies, -1)).toBe(0)
      expect(calculateRefundPercent(defaultPolicies, -10)).toBe(0)
    })

    it("returns full refund when more than 14 days before service", () => {
      expect(calculateRefundPercent(defaultPolicies, 30)).toBe(100)
      expect(calculateRefundPercent(defaultPolicies, 15)).toBe(100)
      expect(calculateRefundPercent(defaultPolicies, 14)).toBe(100)
    })

    it("returns 75% refund for 7-13 days before service", () => {
      expect(calculateRefundPercent(defaultPolicies, 13)).toBe(75)
      expect(calculateRefundPercent(defaultPolicies, 10)).toBe(75)
      expect(calculateRefundPercent(defaultPolicies, 7)).toBe(75)
    })

    it("returns 50% refund for 3-6 days before service", () => {
      expect(calculateRefundPercent(defaultPolicies, 6)).toBe(50)
      expect(calculateRefundPercent(defaultPolicies, 5)).toBe(50)
      expect(calculateRefundPercent(defaultPolicies, 3)).toBe(50)
    })

    it("returns 25% refund for 1-2 days before service", () => {
      expect(calculateRefundPercent(defaultPolicies, 2)).toBe(25)
      expect(calculateRefundPercent(defaultPolicies, 1)).toBe(25)
    })

    it("returns 0% refund on day of service", () => {
      expect(calculateRefundPercent(defaultPolicies, 0)).toBe(0)
    })

    it("returns full refund when no policies exist", () => {
      expect(calculateRefundPercent([], 5)).toBe(100)
    })

    it("handles unsorted policies correctly", () => {
      const unsortedPolicies = [
        { daysBeforeService: 3, nonRefundablePercent: 50 },
        { daysBeforeService: 14, nonRefundablePercent: 0 },
        { daysBeforeService: 7, nonRefundablePercent: 25 },
      ]
      
      expect(calculateRefundPercent(unsortedPolicies, 14)).toBe(100)
      expect(calculateRefundPercent(unsortedPolicies, 7)).toBe(75)
      expect(calculateRefundPercent(unsortedPolicies, 3)).toBe(50)
    })

    it("handles single policy correctly", () => {
      const singlePolicy = [{ daysBeforeService: 7, nonRefundablePercent: 50 }]
      
      // 10 days >= 7 days threshold, so policy applies: 100 - 50 = 50%
      expect(calculateRefundPercent(singlePolicy, 10)).toBe(50)
      expect(calculateRefundPercent(singlePolicy, 7)).toBe(50)
      // 5 days < 7 days threshold, so no policy matches, full refund
      expect(calculateRefundPercent(singlePolicy, 5)).toBe(100)
    })
  })
})

