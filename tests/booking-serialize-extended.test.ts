import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"
const Decimal = Prisma.Decimal
import { serializeBookingForClient } from "@/lib/bookings/serialize"

describe("serializeBookingForClient - extended edge cases", () => {
  it("handles null paymentIntentId", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("123.45"),
      totalRefunded: new Decimal("0"),
      status: "CONFIRMED",
      paymentIntentId: null,
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.paymentIntentId).toBeNull()
    expect(JSON.parse(JSON.stringify(serialized)).paymentIntentId).toBeNull()
  })

  it("handles zero total", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("0"),
      totalRefunded: new Decimal("0"),
      status: "PENDING",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.total).toBe(0)
    expect(serialized.totalRefunded).toBe(0)
  })

  it("handles negative total (refund scenario)", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("-50.00"),
      totalRefunded: new Decimal("100.00"),
      status: "CANCELLED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.total).toBe(-50)
    expect(serialized.totalRefunded).toBe(100)
  })

  it("handles very large decimal values", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("999999.99"),
      totalRefunded: new Decimal("500000.50"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.total).toBe(999999.99)
    expect(serialized.totalRefunded).toBe(500000.5)
  })

  it("handles very small decimal values", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("0.01"),
      totalRefunded: new Decimal("0.005"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.total).toBe(0.01)
    expect(serialized.totalRefunded).toBe(0.005)
  })

  it("handles all booking statuses", () => {
    const statuses = ["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"]

    statuses.forEach((status) => {
      const booking = {
        id: "booking-123",
        total: new Decimal("100.00"),
        totalRefunded: new Decimal("0"),
        status,
        paymentIntentId: "pi_123",
        eventDate: new Date("2025-12-25T10:00:00.000Z"),
      } as any

      const serialized = serializeBookingForClient(booking)

      expect(serialized.status).toBe(status)
    })
  })

  it("handles eventDate as Date object", () => {
    const date = new Date("2025-12-25T10:30:45.123Z")
    const booking = {
      id: "booking-123",
      total: new Decimal("100.00"),
      totalRefunded: new Decimal("0"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: date,
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.eventDate).toBe(date.toISOString())
  })

  it("handles eventDate as string", () => {
    const dateString = "2025-12-25T10:30:45.123Z"
    const booking = {
      id: "booking-123",
      total: new Decimal("100.00"),
      totalRefunded: new Decimal("0"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: dateString,
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.eventDate).toBe(new Date(dateString).toISOString())
  })

  it("handles eventDate as number (timestamp)", () => {
    const timestamp = new Date("2025-12-25T10:30:45.123Z").getTime()
    const booking = {
      id: "booking-123",
      total: new Decimal("100.00"),
      totalRefunded: new Decimal("0"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: timestamp,
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.eventDate).toBe(new Date(timestamp).toISOString())
  })

  it("handles empty string paymentIntentId", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("100.00"),
      totalRefunded: new Decimal("0"),
      status: "PENDING",
      paymentIntentId: "",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized.paymentIntentId).toBe("")
  })

  it("preserves all required fields", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("123.45"),
      totalRefunded: new Decimal("10.00"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized).toHaveProperty("id")
    expect(serialized).toHaveProperty("total")
    expect(serialized).toHaveProperty("totalRefunded")
    expect(serialized).toHaveProperty("status")
    expect(serialized).toHaveProperty("paymentIntentId")
    expect(serialized).toHaveProperty("eventDate")
  })

  it("produces JSON-serializable output", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("123.45"),
      totalRefunded: new Decimal("10.00"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)
    const jsonString = JSON.stringify(serialized)
    const parsed = JSON.parse(jsonString)

    expect(parsed).toEqual({
      id: "booking-123",
      total: 123.45,
      totalRefunded: 10,
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: "2025-12-25T10:00:00.000Z",
    })
  })

  it("handles multiple round trips through JSON", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("123.45"),
      totalRefunded: new Decimal("10.00"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    let serialized = serializeBookingForClient(booking)

    // Multiple round trips
    for (let i = 0; i < 5; i++) {
      const jsonString = JSON.stringify(serialized)
      serialized = JSON.parse(jsonString)
    }

    expect(serialized).toEqual({
      id: "booking-123",
      total: 123.45,
      totalRefunded: 10,
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: "2025-12-25T10:00:00.000Z",
    })
  })

  it("handles decimal values with many decimal places", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("123.456789012345"),
      totalRefunded: new Decimal("10.987654321098"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(typeof serialized.total).toBe("number")
    expect(typeof serialized.totalRefunded).toBe("number")
    expect(serialized.total).toBeCloseTo(123.456789012345)
    expect(serialized.totalRefunded).toBeCloseTo(10.987654321098)
  })

  it("handles eventDate at different times of day", () => {
    const times = [
      "2025-12-25T00:00:00.000Z",
      "2025-12-25T12:00:00.000Z",
      "2025-12-25T23:59:59.999Z",
    ]

    times.forEach((timeStr) => {
      const booking = {
        id: "booking-123",
        total: new Decimal("100.00"),
        totalRefunded: new Decimal("0"),
        status: "CONFIRMED",
        paymentIntentId: "pi_123",
        eventDate: new Date(timeStr),
      } as any

      const serialized = serializeBookingForClient(booking)

      expect(serialized.eventDate).toBe(timeStr)
    })
  })
})
