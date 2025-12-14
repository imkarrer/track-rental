import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST as createCode } from "@/app/api/referrals/create/route"
import { POST as redeemCode } from "@/app/api/referrals/redeem/route"
import { NextRequest } from "next/server"

const mockPrisma = vi.hoisted(() => ({
  referralCode: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  referralRedemption: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
  },
  referralProgramConfig: {
    findMany: vi.fn(),
  },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))
vi.mock("next-auth", async () => {
  const actual: any = await vi.importActual("next-auth")
  return {
    ...actual,
    getServerSession: vi.fn(() =>
      Promise.resolve({
        user: { id: "user-1" },
      })
    ),
  }
})

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("referrals", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.referralCode.create.mockImplementation(async ({ data }) => ({
      code: data.code ?? "ABC123",
      maxUses: data.maxUses ?? 50,
      uses: 0,
    }))
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        referralCode: mockPrisma.referralCode,
        referralRedemption: mockPrisma.referralRedemption,
      })
    )
    mockPrisma.referralProgramConfig.findMany.mockResolvedValue([])
    // Mock user as verified
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", emailVerified: new Date() })
  })

  it("creates a referral code for the current user", async () => {
    const res = await createCode(makePost({ maxUses: 10 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBeDefined()
    expect(json.maxUses).toBe(10)
  })

  it("redeems a referral code for a different user and increments uses", async () => {
    const referral = {
      id: "code-1",
      code: "JOINME",
      ownerUserId: "owner-1",
      owner: { id: "owner-1", role: "USER" },
      maxUses: 5,
      uses: 1,
    }
    mockPrisma.referralCode.findUnique.mockResolvedValue(referral)
    mockPrisma.referralRedemption.findUnique.mockResolvedValue(null)
    mockPrisma.referralCode.update.mockResolvedValue({ ...referral, uses: referral.uses + 1 })
    mockPrisma.referralRedemption.create.mockResolvedValue({ id: "red-1" })

    const res = await redeemCode(makePost({ code: "JOINME" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.redeemed).toBe(true)
    expect(json.uses).toBe(2)
  })
})


