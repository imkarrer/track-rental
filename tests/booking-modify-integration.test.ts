/**
 * Integration test for booking modification algorithm
 * 
 * This test verifies that the modify calculator integrates correctly
 * with the refund calculator and handles real database-like data.
 */

import { describe, it, expect } from "vitest"
import { calculateModifyFinancials } from "@/lib/booking/modify-calculator"
import { calculateRefundPercent } from "@/lib/booking/refund-calculator"
import { Decimal } from "@prisma/client/runtime/library"

describe("Modify Calculator Integration", () => {
  // Simulate refund policies from database
  const dbRefundPolicies = [
    { 
      id: "1",
      daysBeforeService: 14, 
      nonRefundablePercent: new Decimal(10),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: "2",
      daysBeforeService: 7, 
      nonRefundablePercent: new Decimal(25),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: "3",
      daysBeforeService: 3, 
      nonRefundablePercent: new Decimal(50),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: "4",
      daysBeforeService: 0, 
      nonRefundablePercent: new Decimal(100),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
  ]

  it("should integrate with refund calculator correctly", () => {
    // First, verify refund calculator works
    const policies = dbRefundPolicies.map(p => ({
      daysBeforeService: p.daysBeforeService,
      nonRefundablePercent: Number(p.nonRefundablePercent)
    }))
    
    const refundPercent = calculateRefundPercent(policies, 30)
    expect(refundPercent).toBe(90) // 30 days = 90% refundable

    // Now test the full modify calculator
    const result = calculateModifyFinancials(
      {
        oldTotal: 1000,
        oldPromoDiscount: 100,
        oldEventDate: "2025-12-20",
        newTotal: 1200,
        newEventDate: "2025-12-25", // Different date = reschedule
        refundPolicies: dbRefundPolicies,
        daysUntilOriginalEvent: 30,
      },
      "PROMO10"
    )

    expect(result.refundablePercent).toBe(90)
    expect(result.oldTotalWithPromo).toBe(900)
    expect(result.softRefundAmount).toBe(810)
    expect(result.newTotalWithPromo).toBe(1100)
    expect(result.netDifference).toBe(-290)
    expect(result.action).toBe("payment")
    expect(result.actionAmount).toBe(290)
  })

  it("should handle database Decimal types correctly", () => {
    // Simulate booking from database
    const booking = {
      id: "test-id",
      total: new Decimal(1500),
      referralDiscount: new Decimal(150),
      referralCode: "BIGDEAL10"
    }

    const result = calculateModifyFinancials(
      {
        oldTotal: Number(booking.total),
        oldPromoDiscount: Number(booking.referralDiscount),
        oldEventDate: "2025-12-20",
        newTotal: 1800,
        newEventDate: "2025-12-25", // Different date = reschedule
        refundPolicies: dbRefundPolicies,
        daysUntilOriginalEvent: 20,
      },
      booking.referralCode
    )

    expect(result.hasPromoCode).toBe(true)
    expect(result.promoCode).toBe("BIGDEAL10")
    expect(result.promoDiscount).toBe(150)
    expect(result.oldTotalWithPromo).toBe(1350) // 1500 - 150
    expect(result.newTotalWithPromo).toBe(1650) // 1800 - 150
  })

  it("should work with multi-day booking totals", () => {
    // Simulate a 3-day booking
    const multiDayOldTotal = 2400 // $800/day × 3 days
    const multiDayNewTotal = 3000 // $1000/day × 3 days
    const promoDiscount = 240 // 10% off

    const result = calculateModifyFinancials(
      {
        oldTotal: multiDayOldTotal,
        oldPromoDiscount: promoDiscount,
        oldEventDate: "2025-12-20",
        newTotal: multiDayNewTotal,
        newEventDate: "2025-12-25", // Different date = reschedule
        refundPolicies: dbRefundPolicies,
        daysUntilOriginalEvent: 15, // 90% refundable
      },
      "MULTIDAY10"
    )

    // Old: $2400 - $240 = $2160
    // Credit: $2160 × 90% = $1944
    // New: $3000 - $240 = $2760
    // Net: $1944 - $2760 = -$816

    expect(result.oldTotalWithPromo).toBe(2160)
    expect(result.creditAmount).toBe(1944)
    expect(result.newTotalWithPromo).toBe(2760)
    expect(result.netDifference).toBe(-816)
    expect(result.action).toBe("payment")
    expect(result.actionAmount).toBe(816)
  })

  it("should handle edge case: no promo code with database null", () => {
    const booking = {
      referralCode: null,
      referralDiscount: new Decimal(0)
    }

    const result = calculateModifyFinancials(
      {
        oldTotal: 1000,
        oldPromoDiscount: Number(booking.referralDiscount),
        oldEventDate: "2025-12-20",
        newTotal: 1200,
        newEventDate: "2025-12-25", // Different date = reschedule
        refundPolicies: dbRefundPolicies,
        daysUntilOriginalEvent: 30,
      },
      booking.referralCode
    )

    expect(result.hasPromoCode).toBe(false)
    expect(result.promoCode).toBe(null)
    expect(result.promoDiscount).toBe(0)
  })

  it("should produce correct final booking total for database update", () => {
    const result = calculateModifyFinancials(
      {
        oldTotal: 1000,
        oldPromoDiscount: 100,
        oldEventDate: "2025-12-20",
        newTotal: 1200,
        newEventDate: "2025-12-25", // Different date = reschedule
        refundPolicies: dbRefundPolicies,
        daysUntilOriginalEvent: 30,
      },
      "PROMO"
    )

    // The finalBookingTotal should be what we store in the database
    // This should be newTotal with promo applied
    expect(result.finalBookingTotal).toBe(1100) // 1200 - 100
    
    // Verify this matches newTotalWithPromo
    expect(result.finalBookingTotal).toBe(result.newTotalWithPromo)
  })

  it("should handle all refund policy tiers correctly", () => {
    const testCases = [
      { days: 30, expectedRefundPercent: 90 },  // 14+ days
      { days: 14, expectedRefundPercent: 90 },  // Exactly 14 days
      { days: 10, expectedRefundPercent: 75 },  // 7-13 days
      { days: 7, expectedRefundPercent: 75 },   // Exactly 7 days
      { days: 5, expectedRefundPercent: 50 },   // 3-6 days
      { days: 3, expectedRefundPercent: 50 },   // Exactly 3 days
      { days: 2, expectedRefundPercent: 0 },    // 0-2 days
      { days: 0, expectedRefundPercent: 0 },    // Same day
    ]

    testCases.forEach(({ days, expectedRefundPercent }) => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1000,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies: dbRefundPolicies,
          daysUntilOriginalEvent: days,
        },
        "TEST"
      )

      expect(result.refundablePercent).toBe(expectedRefundPercent)
      expect(result.nonRefundablePercent).toBe(100 - expectedRefundPercent)
    })
  })

  it("should maintain precision with Decimal arithmetic", () => {
    // Test with precise decimal values
    const oldTotal = 999.99
    const promoDiscount = 99.99
    const newTotal = 1234.56

    const result = calculateModifyFinancials(
      {
        oldTotal,
        oldPromoDiscount: promoDiscount,
        oldEventDate: "2025-12-20",
        newTotal,
        newEventDate: "2025-12-25", // Different date = reschedule
        refundPolicies: dbRefundPolicies,
        daysUntilOriginalEvent: 30, // 90% refundable
      },
      "PRECISE"
    )

    // Old: 999.99 - 99.99 = 900.00
    // Credit: 900.00 × 0.90 = 810.00
    // New: 1234.56 - 99.99 = 1134.57
    // Net: 810.00 - 1134.57 = -324.57

    expect(result.oldTotalWithPromo).toBe(900)
    expect(result.softRefundAmount).toBe(810)
    expect(result.newTotalWithPromo).toBe(1134.57)
    expect(result.netDifference).toBe(-324.57)
    expect(result.actionAmount).toBe(324.57)
  })
})
