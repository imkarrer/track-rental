import { describe, it, expect } from "vitest"
import { generateReferralCode } from "@/lib/referrals/util"

describe("referrals/util", () => {
  describe("generateReferralCode", () => {
    it("generates an 8-character code by default", () => {
      const code = generateReferralCode()
      expect(code.length).toBe(8)
    })

    it("generates a code of specified length", () => {
      expect(generateReferralCode(4).length).toBe(4)
      expect(generateReferralCode(12).length).toBe(12)
      expect(generateReferralCode(16).length).toBe(16)
    })

    it("generates uppercase alphanumeric codes without ambiguous characters", () => {
      // The ALPHABET excludes I, O, 0, 1 for readability
      for (let i = 0; i < 10; i++) {
        const code = generateReferralCode()
        // Should only contain characters from ALPHABET: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
        // Should NOT contain ambiguous characters
        expect(code).not.toMatch(/[IO01]/)
      }
    })

    it("generates different codes on multiple calls", () => {
      const codes = new Set<string>()
      for (let i = 0; i < 20; i++) {
        codes.add(generateReferralCode())
      }
      // With 8 chars from 32-char alphabet, collisions are extremely unlikely
      expect(codes.size).toBe(20)
    })
  })
})

