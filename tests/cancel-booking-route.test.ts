import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "@/app/api/bookings/[id]/cancel/route"

const mockSession = { user: { id: "user-1", role: "USER" } }

// Use vi.hoisted to ensure mocks are available before vi.mock runs
const { mockPrisma, mockStripe, mockGetRefundCalculation, mockGetServerSession } = vi.hoisted(() => {
  const mockPrismaObj = {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refund: {
      create: vi.fn(),
    },
    bookingHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (prisma: any) => any) => fn(mockPrismaObj)),
  }

  return {
    mockPrisma: mockPrismaObj,
    mockStripe: {
      refunds: {
        create: vi.fn(),
      },
    },
    mockGetRefundCalculation: vi.fn(),
    mockGetServerSession: vi.fn(),
  }
})

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/stripe/config", () => ({ stripe: mockStripe }))
vi.mock("@/lib/refunds/calculate", () => ({
  getRefundCalculation: mockGetRefundCalculation,
}))
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }))
vi.mock("next-auth", () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}))

const futureDate = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

function makeBooking(overrides: Partial<any> = {}) {
  return {
    id: "booking-1",
    userId: "user-1",
    status: "CONFIRMED",
    eventDate: futureDate(),
    total: 100,
    totalRefunded: 0,
    paymentIntentId: "pi_123",
    refunds: [],
    ...overrides,
  }
}

function makeRefundCalc(overrides: Partial<any> = {}) {
  return {
    bookingTotal: 100,
    alreadyRefunded: 0,
    refundableAmount: 60,
    nonRefundableAmount: 40,
    remainingRefundable: 60,
    daysBeforeService: 5,
    policyUsed: { daysBeforeService: 5, nonRefundablePercent: 40 },
    canRefundFull: false,
    ...overrides,
  }
}

const makePostRequest = (body: any) =>
  ({
    json: vi.fn().mockResolvedValue(body),
  } as any)

describe("cancel booking API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSession)
    mockPrisma.booking.findUnique.mockResolvedValue(makeBooking())
    mockPrisma.booking.update.mockResolvedValue({})
    mockPrisma.refund.create.mockResolvedValue({ id: "refund-1" })
    mockStripe.refunds.create.mockResolvedValue({ id: "re_123" })
    mockGetRefundCalculation.mockResolvedValue(makeRefundCalc())
  })

  it("returns preview data and canCancel=true for eligible booking", async () => {
    const res = await GET({} as any, { params: { id: "booking-1" } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.canCancel).toBe(true)
    expect(json.remainingRefundable).toBe(60)
  })

  it("rejects preview when user does not own booking", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(makeBooking({ userId: "other" }))
    const res = await GET({} as any, { params: { id: "booking-1" } })
    expect(res.status).toBe(403)
  })

  it("processes cancellation and refund", async () => {
    const res = await POST(
      makePostRequest({ reason: "Change of plans" }),
      { params: { id: "booking-1" } }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.bookingStatus).toBe("CANCELLED")
    expect(json.refundAmount).toBe(60)
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_123",
        amount: 6000,
        reason: "requested_by_customer",
      })
    )
    expect(mockPrisma.refund.create).toHaveBeenCalled()
    expect(mockPrisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1" },
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    )
  })

  it("rejects cancellation for already cancelled booking", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "CANCELLED" }))
    const res = await POST(makePostRequest({}), { params: { id: "booking-1" } })
    expect(res.status).toBe(400)
  })

  it("rejects cancellation when payment intent is missing", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(makeBooking({ paymentIntentId: null }))
    const res = await POST(makePostRequest({}), { params: { id: "booking-1" } })
    expect(res.status).toBe(400)
  })
})


