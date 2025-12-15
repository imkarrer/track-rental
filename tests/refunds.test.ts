import { describe, it, expect, beforeEach, vi } from "vitest"
import { calculateNonRefundableAmount, getRefundCalculation } from "@/lib/refunds/calculate"

const mockPrisma = vi.hoisted(() => ({
  refundPolicy: { findMany: vi.fn() },
  booking: { findUnique: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("refund calculations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("applies the matching refund policy based on days before service", async () => {
    mockPrisma.refundPolicy.findMany.mockResolvedValue([
      { daysBeforeService: 30, nonRefundablePercent: 10, isActive: true },
      { daysBeforeService: 7, nonRefundablePercent: 50, isActive: true },
    ])

    const serviceDate = new Date("2025-06-15")
    const cancellationDate = new Date("2025-06-01")

    const result = await calculateNonRefundableAmount(200, serviceDate, cancellationDate)

    expect(result.nonRefundableAmount).toBeCloseTo(100)
    expect(result.refundableAmount).toBeCloseTo(100)
    expect(result.policyUsed?.nonRefundablePercent).toBe(50)
    expect(result.daysBeforeService).toBeGreaterThan(0)
  })

  it("returns full refund when no policies apply and service is in the future", async () => {
    mockPrisma.refundPolicy.findMany.mockResolvedValue([])

    const serviceDate = new Date("2025-08-10")
    const cancellationDate = new Date("2025-08-01")

    const result = await calculateNonRefundableAmount(150, serviceDate, cancellationDate)

    expect(result.nonRefundableAmount).toBe(0)
    expect(result.refundableAmount).toBe(150)
    expect(result.policyUsed).toBeNull()
  })

  it("treats cancellations after the service date as fully non-refundable", async () => {
    mockPrisma.refundPolicy.findMany.mockResolvedValue([])

    const serviceDate = new Date("2025-05-01")
    const cancellationDate = new Date("2025-05-05")

    const result = await calculateNonRefundableAmount(80, serviceDate, cancellationDate)

    expect(result.nonRefundableAmount).toBe(80)
    expect(result.refundableAmount).toBe(0)
    expect(result.policyUsed?.nonRefundablePercent).toBe(100)
    expect(result.daysBeforeService).toBeLessThan(0)
  })

  it("calculates remaining refundable balance on an existing booking", async () => {
    mockPrisma.refundPolicy.findMany.mockResolvedValue([
      { daysBeforeService: 1, nonRefundablePercent: 40, isActive: true },
    ])

    const booking = {
      id: "booking-1",
      eventDate: new Date("2025-12-20"),
      total: 200,
      totalRefunded: 40,
      refunds: [],
    }

    mockPrisma.booking.findUnique.mockResolvedValue(booking)

    const result = await getRefundCalculation("booking-1")

    expect(result.bookingTotal).toBe(200)
    expect(result.nonRefundableAmount).toBeCloseTo(80)
    expect(result.refundableAmount).toBeCloseTo(120)
    expect(result.remainingRefundable).toBeCloseTo(80)
    expect(result.canRefundFull).toBe(false)
  })
})


