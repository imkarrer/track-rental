import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST as createReservation } from "@/app/api/reservations/create/route"
import { POST as createPaymentIntent } from "@/app/api/payment/create-intent/route"

const mockPrisma = vi.hoisted(() => ({
  reservation: {
    deleteMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  booking: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  track: {
    findMany: vi.fn(),
  },
  referralProgramConfig: {
    findMany: vi.fn(),
  },
  referralRedemption: {
    findUnique: vi.fn(),
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

const stripeMock = vi.hoisted(() => ({
  paymentIntents: {
    create: vi.fn(async (args) => ({
      id: "pi_123",
      client_secret: "secret_123",
      ...args,
    })),
  },
}))

vi.mock("@/lib/stripe/config", () => ({ stripe: stripeMock }))

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function makeJsonRequest(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers(),
  } as unknown as NextRequest
}

describe("E2E-ish API flows: reservation and payment intent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reservation.deleteMany.mockResolvedValue({})
    mockPrisma.reservation.count.mockResolvedValue(0)
    mockPrisma.reservation.findFirst.mockResolvedValue(null)
    mockPrisma.reservation.findMany.mockResolvedValue([])
    mockPrisma.booking.findFirst.mockResolvedValue(null)
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.booking.count.mockResolvedValue(0)
    mockPrisma.referralProgramConfig.findMany.mockResolvedValue([])
    mockPrisma.referralRedemption.findUnique.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", emailVerified: new Date() })
  })

  it("creates a reservation and returns an expiry", async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockPrisma.reservation.create.mockResolvedValue({
      id: "res-1",
      expiresAt: future,
    })

    const req = makeRequest({
      trackId: "track-1",
      eventDate: "2025-12-25",
      endDate: null,
      startTime: "10:00",
      endTime: "14:00",
      eventAddress: "123 Main",
      eventCity: "City",
      eventState: "CA",
      eventZip: "90210",
      availableSpaceLength: 50,
      availableSpaceWidth: 20,
      selectedCars: [{ carId: "car-1", quantity: 1 }],
      pricing: {
        basePrice: 200,
        dayMultiplier: 1,
        durationMultiplier: 1,
        distanceSurcharge: 0,
        setupFee: 0,
        freeCarsIncluded: 2,
        additionalCarsCount: 0,
        additionalCarsPrice: 0,
        subtotal: 200,
        tax: 16,
        total: 216,
        dayOfWeek: 1,
        durationHours: 4,
        distanceFromBase: 10,
      },
    })

    const res = await createReservation(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.reservation.id).toBe("res-1")
    expect(json.reservation.expiresInSeconds).toBeGreaterThan(0)
    expect(mockPrisma.reservation.create).toHaveBeenCalled()
  })

  it("creates a payment intent for the reservation owner and returns client secret", async () => {
    const reservationId = "11111111-1111-1111-1111-111111111111"
    mockPrisma.reservation.findUnique.mockResolvedValue({
      id: reservationId,
      userId: "user-1",
      total: 123.45,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      trackId: "track-1",
      track: { name: "Pro Track" },
      user: { id: "user-1", role: "USER" },
    })
    mockPrisma.referralRedemption.findUnique.mockResolvedValue(null)

    const req = makeJsonRequest({ reservationId })
    const res = await createPaymentIntent(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.clientSecret).toBe("secret_123")
    expect(json.paymentIntentId).toBe("pi_123")

    expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12345,
        currency: "usd",
        metadata: expect.objectContaining({
          reservationId,
          userId: "user-1",
          trackId: "track-1",
        }),
      })
    )
  })
})


