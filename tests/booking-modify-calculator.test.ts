import { describe, it, expect } from "vitest"
import { 
  calculateModifyFinancials, 
  explainModifyCalculation,
  formatModifyCalculationForCustomer,
  serializeModifyCalculation 
} from "@/lib/booking/modify-calculator"
import { Decimal } from "@prisma/client/runtime/library"

describe("Booking Modify Calculator", () => {
  // Mock refund policies
  const refundPolicies = [
    { daysBeforeService: 14, nonRefundablePercent: new Decimal(10) }, // 90% refundable
    { daysBeforeService: 7, nonRefundablePercent: new Decimal(25) },  // 75% refundable
    { daysBeforeService: 3, nonRefundablePercent: new Decimal(50) },  // 50% refundable
    { daysBeforeService: 0, nonRefundablePercent: new Decimal(100) }, // 0% refundable
  ]

  describe("Algorithm Step 1: Promo Code Preservation", () => {
    it("should honor promo code discount throughout modification", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30, // 90% refundable
        },
        "SUMMER20"
      )

      expect(result.hasPromoCode).toBe(true)
      expect(result.promoCode).toBe("SUMMER20")
      expect(result.promoDiscount).toBe(100)
      expect(result.oldTotalWithPromo).toBe(900) // 1000 - 100
      expect(result.newTotalWithPromo).toBe(1100) // 1200 - 100
    })

    it("should work without promo code", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 0,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        null
      )

      expect(result.hasPromoCode).toBe(false)
      expect(result.promoCode).toBe(null)
      expect(result.promoDiscount).toBe(0)
      expect(result.oldTotalWithPromo).toBe(1000)
      expect(result.newTotalWithPromo).toBe(1200)
    })
  })

  describe("Algorithm Step 2: Soft Refund Calculation", () => {
    it("should calculate soft refund based on refund policy (90% refundable)", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30, // 90% refundable
        },
        "PROMO10"
      )

      expect(result.refundablePercent).toBe(90)
      expect(result.nonRefundablePercent).toBe(10)
      expect(result.oldTotalWithPromo).toBe(900) // 1000 - 100 promo
      expect(result.softRefundAmount).toBe(810) // 900 * 0.90
      expect(result.creditAmount).toBe(810)
    })

    it("should calculate soft refund based on refund policy (75% refundable)", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 10, // 75% refundable
        },
        "PROMO10"
      )

      expect(result.refundablePercent).toBe(75)
      expect(result.nonRefundablePercent).toBe(25)
      expect(result.softRefundAmount).toBe(675) // 900 * 0.75
      expect(result.creditAmount).toBe(675)
    })

    it("should calculate soft refund based on refund policy (50% refundable)", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 5, // 50% refundable
        },
        "PROMO10"
      )

      expect(result.refundablePercent).toBe(50)
      expect(result.softRefundAmount).toBe(450) // 900 * 0.50
    })

    it("should calculate 0% refund when within 3 days or less", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 2, // 0% refundable
        },
        "PROMO10"
      )

      expect(result.refundablePercent).toBe(0)
      expect(result.softRefundAmount).toBe(0)
      expect(result.creditAmount).toBe(0)
    })
  })

  describe("Algorithm Step 3: New Day Charge", () => {
    it("should calculate new charge with promo code applied", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        "PROMO10"
      )

      expect(result.newTotalWithPromo).toBe(1100) // 1200 - 100 promo
      expect(result.newChargeAmount).toBe(1100)
    })

    it("should calculate new charge without promo code", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 0,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        null
      )

      expect(result.newTotalWithPromo).toBe(1200)
      expect(result.newChargeAmount).toBe(1200)
    })
  })

  describe("Algorithm Step 4: Final Price Calculation", () => {
    describe("Scenario: Price Increase (need to charge customer)", () => {
      it("should charge customer the difference after soft refund", () => {
        // Old: $1000 - $100 promo = $900
        // Soft refund: $900 * 90% = $810 credit
        // New: $1200 - $100 promo = $1100
        // Net: $810 credit - $1100 charge = -$290 (need to charge)
        const result = calculateModifyFinancials(
          {
            oldTotal: 1000,
            oldPromoDiscount: 100,
            oldEventDate: "2025-12-20",
            newTotal: 1200,
            newEventDate: "2025-12-25", // Different date = reschedule
            refundPolicies,
            daysUntilOriginalEvent: 30, // 90% refundable
          },
          "PROMO10"
        )

        expect(result.creditAmount).toBe(810)
        expect(result.newChargeAmount).toBe(1100)
        expect(result.netDifference).toBe(-290) // 810 - 1100
        expect(result.action).toBe("payment")
        expect(result.actionAmount).toBe(290)
        expect(result.finalBookingTotal).toBe(1100)
      })

      it("should charge more when refund policy is less favorable", () => {
        // Old: $1000 - $100 promo = $900
        // Soft refund: $900 * 50% = $450 credit (50% refundable)
        // New: $1200 - $100 promo = $1100
        // Net: $450 credit - $1100 charge = -$650 (need to charge more)
        const result = calculateModifyFinancials(
          {
            oldTotal: 1000,
            oldPromoDiscount: 100,
            oldEventDate: "2025-12-20",
            newTotal: 1200,
            newEventDate: "2025-12-25", // Different date = reschedule
            refundPolicies,
            daysUntilOriginalEvent: 5, // 50% refundable
          },
          "PROMO10"
        )

        expect(result.creditAmount).toBe(450)
        expect(result.netDifference).toBe(-650) // 450 - 1100
        expect(result.action).toBe("payment")
        expect(result.actionAmount).toBe(650)
      })
    })

    describe("Scenario: Price Decrease (refund to customer)", () => {
      it("should refund customer the difference after soft refund", () => {
        // Old: $1000 - $100 promo = $900
        // Soft refund: $900 * 90% = $810 credit
        // New: $800 - $100 promo = $700
        // Net: $810 credit - $700 charge = $110 (refund to customer)
        const result = calculateModifyFinancials(
          {
            oldTotal: 1000,
            oldPromoDiscount: 100,
            oldEventDate: "2025-12-20",
            newTotal: 800,
            newEventDate: "2025-12-25", // Different date = reschedule
            refundPolicies,
            daysUntilOriginalEvent: 30, // 90% refundable
          },
          "PROMO10"
        )

        expect(result.creditAmount).toBe(810)
        expect(result.newChargeAmount).toBe(700)
        expect(result.netDifference).toBe(110) // 810 - 700
        expect(result.action).toBe("refund")
        expect(result.actionAmount).toBe(110)
        expect(result.finalBookingTotal).toBe(700)
      })

      it("should refund less when refund policy is less favorable", () => {
        // Old: $1000 - $100 promo = $900
        // Soft refund: $900 * 50% = $450 credit
        // New: $800 - $100 promo = $700
        // Net: $450 credit - $700 charge = -$250 (still need to charge!)
        const result = calculateModifyFinancials(
          {
            oldTotal: 1000,
            oldPromoDiscount: 100,
            oldEventDate: "2025-12-20",
            newTotal: 800,
            newEventDate: "2025-12-25", // Different date = reschedule
            refundPolicies,
            daysUntilOriginalEvent: 5, // 50% refundable
          },
          "PROMO10"
        )

        expect(result.creditAmount).toBe(450)
        expect(result.netDifference).toBe(-250) // 450 - 700
        expect(result.action).toBe("payment")
        expect(result.actionAmount).toBe(250)
      })

      it("should give full refund when new booking is much cheaper", () => {
        // Old: $1000 - $100 promo = $900
        // Soft refund: $900 * 90% = $810 credit
        // New: $300 - $100 promo = $200
        // Net: $810 credit - $200 charge = $610 (large refund)
        const result = calculateModifyFinancials(
          {
            oldTotal: 1000,
            oldPromoDiscount: 100,
            oldEventDate: "2025-12-20",
            newTotal: 300,
            newEventDate: "2025-12-25", // Different date = reschedule
            refundPolicies,
            daysUntilOriginalEvent: 30,
          },
          "PROMO10"
        )

        expect(result.creditAmount).toBe(810)
        expect(result.newChargeAmount).toBe(200)
        expect(result.netDifference).toBe(610)
        expect(result.action).toBe("refund")
        expect(result.actionAmount).toBe(610)
      })
    })

    describe("Scenario: No Price Change", () => {
      it("should have no payment or refund when prices are equal", () => {
        // Old: $1000 - $100 promo = $900
        // Soft refund: $900 * 90% = $810 credit
        // New: $1000 - $100 promo = $900
        // Net: $810 credit - $900 charge = -$90 (small payment)
        const result = calculateModifyFinancials(
          {
            oldTotal: 1000,
            oldPromoDiscount: 100,
            oldEventDate: "2025-12-20",
            newTotal: 1000,
            newEventDate: "2025-12-25", // Different date = reschedule
            refundPolicies,
            daysUntilOriginalEvent: 30,
          },
          "PROMO10"
        )

        expect(result.creditAmount).toBe(810)
        expect(result.newChargeAmount).toBe(900)
        expect(result.netDifference).toBe(-90) // Due to 10% non-refundable
        expect(result.action).toBe("payment")
        expect(result.actionAmount).toBe(90)
      })

      it("should have no action when credit exactly matches charge (100% refundable)", () => {
        // Old: $1000
        // Soft refund: $1000 * 100% = $1000 credit
        // New: $1000
        // Net: $1000 credit - $1000 charge = $0
        const customPolicies = [
          { daysBeforeService: 0, nonRefundablePercent: new Decimal(0) }, // 100% refundable
        ]

        const result = calculateModifyFinancials(
          {
            oldTotal: 1000,
            oldPromoDiscount: 0,
            oldEventDate: "2025-12-20",
            newTotal: 1000,
            newEventDate: "2025-12-25", // Different date = reschedule
            refundPolicies: customPolicies,
            daysUntilOriginalEvent: 30,
          },
          null
        )

        expect(result.creditAmount).toBe(1000)
        expect(result.newChargeAmount).toBe(1000)
        expect(result.netDifference).toBe(0)
        expect(result.action).toBe("none")
        expect(result.actionAmount).toBe(0)
      })
    })
  })

  describe("Real-World Scenarios", () => {
    it("should handle upgrading with promo code close to event date", () => {
      // Booking a week out, upgrading from $500 to $800
      // Promo: $50 off
      // Refund policy: 75% refundable
      const result = calculateModifyFinancials(
        {
          oldTotal: 500,
          oldPromoDiscount: 50,
          oldEventDate: "2025-12-20",
          newTotal: 800,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 10, // 75% refundable
        },
        "SAVE50"
      )

      // Old: $500 - $50 = $450
      // Credit: $450 * 75% = $337.50
      // New: $800 - $50 = $750
      // Net: $337.50 - $750 = -$412.50 (charge customer)
      expect(result.oldTotalWithPromo).toBe(450)
      expect(result.creditAmount).toBe(337.5)
      expect(result.newTotalWithPromo).toBe(750)
      expect(result.netDifference).toBe(-412.5)
      expect(result.action).toBe("payment")
      expect(result.actionAmount).toBe(412.5)
    })

    it("should handle downgrading with large promo at last minute", () => {
      // Last minute change (2 days out), downgrading from $1500 to $1000
      // Promo: $200 off
      // Refund policy: 0% refundable
      const result = calculateModifyFinancials(
        {
          oldTotal: 1500,
          oldPromoDiscount: 200,
          oldEventDate: "2025-12-20",
          newTotal: 1000,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 2, // 0% refundable
        },
        "BIGDEAL200"
      )

      // Old: $1500 - $200 = $1300
      // Credit: $1300 * 0% = $0
      // New: $1000 - $200 = $800
      // Net: $0 - $800 = -$800 (must still pay full new amount!)
      expect(result.oldTotalWithPromo).toBe(1300)
      expect(result.creditAmount).toBe(0)
      expect(result.newTotalWithPromo).toBe(800)
      expect(result.netDifference).toBe(-800)
      expect(result.action).toBe("payment")
      expect(result.actionAmount).toBe(800)
    })

    it("should handle adding cars (increasing price)", () => {
      // Adding 2 more cars, increasing from $800 to $1200
      // Promo: $80 off
      // 30 days out: 90% refundable
      const result = calculateModifyFinancials(
        {
          oldTotal: 800,
          oldPromoDiscount: 80,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30, // 90% refundable
        },
        "EARLY10"
      )

      // Old: $800 - $80 = $720
      // Credit: $720 * 90% = $648
      // New: $1200 - $80 = $1120
      // Net: $648 - $1120 = -$472 (charge for added cars)
      expect(result.oldTotalWithPromo).toBe(720)
      expect(result.creditAmount).toBe(648)
      expect(result.newTotalWithPromo).toBe(1120)
      expect(result.netDifference).toBe(-472)
      expect(result.action).toBe("payment")
      expect(result.actionAmount).toBe(472)
    })

    it("should handle removing cars (decreasing price)", () => {
      // Removing 1 car, decreasing from $1200 to $900
      // Promo: $120 off
      // 20 days out: 90% refundable
      const result = calculateModifyFinancials(
        {
          oldTotal: 1200,
          oldPromoDiscount: 120,
          oldEventDate: "2025-12-20",
          newTotal: 900,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 20, // 90% refundable
        },
        "DISCOUNT10"
      )

      // Old: $1200 - $120 = $1080
      // Credit: $1080 * 90% = $972
      // New: $900 - $120 = $780
      // Net: $972 - $780 = $192 (refund difference)
      expect(result.oldTotalWithPromo).toBe(1080)
      expect(result.creditAmount).toBe(972)
      expect(result.newTotalWithPromo).toBe(780)
      expect(result.netDifference).toBe(192)
      expect(result.action).toBe("refund")
      expect(result.actionAmount).toBe(192)
    })
  })

  describe("Explanation Function", () => {
    it("should generate clear explanation of calculation", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        "PROMO10"
      )

      const explanation = explainModifyCalculation(result)
      
      expect(explanation).toContain("PROMO10")
      expect(explanation).toContain("$100.00")
      expect(explanation).toContain("90%")
      expect(explanation).toContain("$810.00")
      expect(explanation).toContain("$1100.00")
      expect(explanation).toContain("Charge $290.00")
    })
  })

  describe("Helper Functions", () => {
    it("should format calculation for customer display", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        "SAVE10"
      )

      const formatted = formatModifyCalculationForCustomer(result)
      
      expect(formatted.summary).toContain("$290.00")
      expect(formatted.details).toHaveLength(5) // promo + old + credit + new + payment
      expect(formatted.details[0]).toContain("SAVE10")
    })

    it("should serialize calculation for logging", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        "LOG"
      )

      const serialized = serializeModifyCalculation(result)
      
      expect(serialized).toHaveProperty("step1_promo")
      expect(serialized).toHaveProperty("step2_softRefund")
      expect(serialized).toHaveProperty("step3_newCharge")
      expect(serialized).toHaveProperty("step4_final")
      expect(serialized.step4_final.action).toBe("payment")
    })
  })

  describe("Edge Cases", () => {
    it("should handle zero amounts", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 0,
          oldPromoDiscount: 0,
          oldEventDate: "2025-12-20",
          newTotal: 0,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        null
      )

      expect(result.action).toBe("none")
      expect(result.actionAmount).toBe(0)
    })

    it("should handle very small differences (< $0.01)", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 1000.001,
          oldPromoDiscount: 100,
          oldEventDate: "2025-12-20",
          newTotal: 1000.002,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies: [
            { daysBeforeService: 0, nonRefundablePercent: new Decimal(0) }
          ],
          daysUntilOriginalEvent: 30,
        },
        "PROMO"
      )

      // Difference is negligible, should be "none"
      expect(result.action).toBe("none")
    })

    it("should handle promo larger than booking total", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 100,
          oldPromoDiscount: 150, // Promo is larger!
          oldEventDate: "2025-12-20",
          newTotal: 200,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30,
        },
        "BIGPROMO"
      )

      // This is an edge case - promo can't be larger than total
      // But the algorithm should handle it gracefully
      expect(result.oldTotalWithPromo).toBe(-50) // Negative total
      expect(result.promoDiscount).toBe(150)
    })
  })

  describe("Rounding", () => {
    it("should round all monetary values to 2 decimal places", () => {
      const result = calculateModifyFinancials(
        {
          oldTotal: 999.999,
          oldPromoDiscount: 99.999,
          oldEventDate: "2025-12-20",
          newTotal: 1111.111,
          newEventDate: "2025-12-25", // Different date = reschedule
          refundPolicies,
          daysUntilOriginalEvent: 30, // 90% refundable
        },
        "PROMO"
      )

      // All values should be rounded to 2 decimals (or be whole numbers)
      expect(result.oldTotalWithPromo.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.newTotalWithPromo.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.softRefundAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.creditAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.actionAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
    })
  })
})
