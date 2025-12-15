import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"
const Decimal = Prisma.Decimal
import { serializeBookingForClient } from "@/lib/bookings/serialize"

describe("serializeBookingForClient", () => {
  it("strips Prisma Decimal and Date objects to plain serializable values", () => {
    const booking = {
      id: "booking-123",
      total: new Decimal("123.45"),
      totalRefunded: new Decimal("10.00"),
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: new Date("2025-12-25T10:00:00.000Z"),
    } as any

    const serialized = serializeBookingForClient(booking)

    expect(serialized).toEqual({
      id: "booking-123",
      total: 123.45,
      totalRefunded: 10,
      status: "CONFIRMED",
      paymentIntentId: "pi_123",
      eventDate: "2025-12-25T10:00:00.000Z",
    })

    // Ensure JSON serialization does not reintroduce non-plain objects
    const roundTrip = JSON.parse(JSON.stringify(serialized))
    expect(roundTrip).toEqual(serialized)
  })
})


