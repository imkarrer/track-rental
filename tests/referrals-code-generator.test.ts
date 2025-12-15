import { describe, it, expect } from "vitest"
import {
  generateCatchyCodeName,
  generatePromoCode,
  generateUserReferralCode,
} from "@/lib/referrals/code-generator"

describe("referrals/code-generator", () => {
  describe("generateCatchyCodeName", () => {
    it("generates a non-empty string", () => {
      const code = generateCatchyCodeName()
      expect(code.length).toBeGreaterThan(0)
    })

    it("generates different codes on multiple calls", () => {
      const codes = new Set<string>()
      for (let i = 0; i < 10; i++) {
        codes.add(generateCatchyCodeName())
      }
      // With randomness, we should get several unique codes
      expect(codes.size).toBeGreaterThan(1)
    })

    it("generates code containing only letters", () => {
      for (let i = 0; i < 10; i++) {
        const code = generateCatchyCodeName()
        expect(code).toMatch(/^[A-Za-z]+$/)
      }
    })
  })

  describe("generatePromoCode", () => {
    it("generates an 8-character random code when no name is provided", () => {
      const code = generatePromoCode()
      expect(code.length).toBe(8)
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })

    it("generates code from name when provided", () => {
      const code = generatePromoCode("Summer Sale")
      expect(code).toBe("SUMMERSALE")
    })

    it("removes special characters from name", () => {
      const code = generatePromoCode("Test-Code_2024!")
      expect(code).toBe("TESTCODE2024")
    })

    it("truncates long names to 15 characters", () => {
      const code = generatePromoCode("This Is A Very Long Promo Code Name")
      expect(code.length).toBe(15)
    })

    it("generates random code when name is too short", () => {
      const code = generatePromoCode("Hi")
      expect(code.length).toBe(8)
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })

    it("generates random code when name has only special characters", () => {
      const code = generatePromoCode("---")
      expect(code.length).toBe(8)
    })
  })

  describe("generateUserReferralCode", () => {
    it("generates a 9-character code from user ID", () => {
      const code = generateUserReferralCode("abc12345-6789-abcd-ef01-234567890abc")
      expect(code.length).toBe(9)
    })

    it("uses first 6 characters of UUID (without dashes) as prefix", () => {
      const code = generateUserReferralCode("a1b2c3d4-5678-9abc-def0-123456789abc")
      expect(code.substring(0, 6)).toBe("A1B2C3")
    })

    it("generates uppercase codes", () => {
      const code = generateUserReferralCode("abcdef12-3456-7890-abcd-ef1234567890")
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })

    it("generates different suffixes for same user ID on multiple calls", () => {
      const userId = "test1234-5678-9abc-def0-123456789abc"
      const codes = new Set<string>()
      for (let i = 0; i < 10; i++) {
        codes.add(generateUserReferralCode(userId))
      }
      // Prefix should be same but suffixes should vary
      expect(codes.size).toBeGreaterThan(1)
    })
  })
})

