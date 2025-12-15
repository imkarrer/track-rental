import { describe, it, expect, beforeEach, vi } from "vitest"
import { getAvailableWeeks } from "@/lib/availability/check"

const mockPrisma = vi.hoisted(() => ({
  booking: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  holiday: { findMany: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("getAvailableWeeks - comprehensive edge cases", () => {
  const trackId = "track-1"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should handle bookings that start before the requested range", async () => {
    // Booking starts on Dec 25, ends on Dec 28
    // Requested range is Dec 27-29
    // Dec 27-28 should be unavailable
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        eventDate: new Date("2025-12-25T00:00:00.000Z"),
        endDate: new Date("2025-12-28T00:00:00.000Z"),
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(true)
    expect(result.unavailableDates).toContain("2025-12-27")
    expect(result.unavailableDates).toContain("2025-12-28")
  })

  it("should handle bookings that end after the requested range", async () => {
    // Booking starts on Dec 28, ends on Dec 31
    // Requested range is Dec 27-29
    // Dec 28-29 should be unavailable
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-2",
        eventDate: new Date("2025-12-28T00:00:00.000Z"),
        endDate: new Date("2025-12-31T00:00:00.000Z"),
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(false)
    expect(result.unavailableDates).toContain("2025-12-28")
    expect(result.unavailableDates).toContain("2025-12-29")
  })

  it("should handle bookings completely outside the requested range", async () => {
    // Booking on Dec 20-22, requested range is Dec 27-29
    // All days should be available
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-3",
        eventDate: new Date("2025-12-20T00:00:00.000Z"),
        endDate: new Date("2025-12-22T00:00:00.000Z"),
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
    expect(result.unavailableDates).toEqual([])
  })

  it("should handle holidays outside the requested range", async () => {
    // Holiday on Dec 25, requested range is Dec 27-29
    // Holiday should not affect availability
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([
      {
        date: new Date("2025-12-25T00:00:00.000Z"),
      },
    ])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
    expect(result.unavailableDates).toEqual([])
  })

  it("should handle holidays within the requested range", async () => {
    // Holiday on Dec 28, requested range is Dec 27-29
    // Dec 28 should be unavailable
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([
      {
        date: new Date("2025-12-28T00:00:00.000Z"),
      },
    ])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(true)
    expect(result.unavailableDates).toContain("2025-12-28")
  })

  it("should handle multiple overlapping bookings", async () => {
    // Booking 1: Dec 26-28
    // Booking 2: Dec 28-30
    // Requested range: Dec 27-29
    // Dec 27-29 should all be unavailable
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-4",
        eventDate: new Date("2025-12-26T00:00:00.000Z"),
        endDate: new Date("2025-12-28T00:00:00.000Z"),
      },
      {
        id: "booking-5",
        eventDate: new Date("2025-12-28T00:00:00.000Z"),
        endDate: new Date("2025-12-30T00:00:00.000Z"),
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(false)
    // unavailableDates includes dates from bookings that overlap the range
    // Booking 1 covers Dec 26-28, Booking 2 covers Dec 28-30
    // So unavailableDates includes Dec 26, 27, 28, 29, 30 (all overlapping dates)
    expect(result.unavailableDates.length).toBeGreaterThanOrEqual(3)
    expect(result.unavailableDates).toContain("2025-12-27")
    expect(result.unavailableDates).toContain("2025-12-28")
    expect(result.unavailableDates).toContain("2025-12-29")
  })

  it("should handle excludeUserId correctly", async () => {
    // Reservation by user-1 on Dec 28
    // When excludeUserId is user-1, Dec 28 should be available
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockImplementation(async (args: any) => {
      // If excludeUserId is provided (userId.not is set), return empty array
      if (args?.where?.userId?.not) {
        return []
      }
      return [
        {
          eventDate: new Date("2025-12-28T00:00:00.000Z"),
          endDate: null,
        },
      ]
    })

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-27",
      "2025-12-29",
      undefined,
      "user-1"
    )

    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.unavailableDates).not.toContain("2025-12-28")

    // Verify the query excluded the user ID
    const where = mockPrisma.reservation.findMany.mock.calls[0][0]?.where
    expect(where?.userId?.not).toBe("user-1")
  })

  it("should handle excludeUserId with bookings", async () => {
    // Booking by another user on Dec 27
    // Reservation by user-1 on Dec 28
    // When excludeUserId is user-1, Dec 27 unavailable, Dec 28 available
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-6",
        eventDate: new Date("2025-12-27T00:00:00.000Z"),
        endDate: null,
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.userId?.not) {
        return []
      }
      return [
        {
          eventDate: new Date("2025-12-28T00:00:00.000Z"),
          endDate: null,
        },
      ]
    })

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-27",
      "2025-12-29",
      undefined,
      "user-1"
    )

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
  })

  it("should handle empty result sets correctly", async () => {
    // No bookings, reservations, or holidays
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
    expect(result.unavailableDates).toEqual([])
  })

  it("should handle single day range correctly", async () => {
    // Request availability for just one day
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-28", "2025-12-28", undefined)

    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(Object.keys(result.availableDays).length).toBe(1)
  })

  it("should handle bookings with only CONFIRMED status", async () => {
    // Only CONFIRMED bookings should block availability
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-7",
        eventDate: new Date("2025-12-28T00:00:00.000Z"),
        endDate: null,
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-28"]).toBe(false)
    
    // Verify the query filters by status
    const where = mockPrisma.booking.findMany.mock.calls[0][0]?.where
    expect(where?.status?.in).toEqual(["CONFIRMED", "PENDING"])
  })

  it("should handle multi-day reservations correctly", async () => {
    // Reservation from Dec 27-29
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([
      {
        eventDate: new Date("2025-12-27T00:00:00.000Z"),
        endDate: new Date("2025-12-29T00:00:00.000Z"),
      },
    ])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(false)
    expect(result.unavailableDates).toContain("2025-12-27")
    expect(result.unavailableDates).toContain("2025-12-28")
    expect(result.unavailableDates).toContain("2025-12-29")
  })

  it("should handle expired reservations correctly", async () => {
    // Expired reservations should not block availability
    // The function filters by expiresAt > new Date(), so expired ones won't be returned
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([]) // No active reservations

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
    
    // Verify the query filters by expiresAt
    const where = mockPrisma.reservation.findMany.mock.calls[0][0]?.where
    expect(where?.expiresAt?.gt).toBeInstanceOf(Date)
  })

  it("should combine bookings, reservations, and holidays correctly", async () => {
    // Booking on Dec 27
    // Reservation on Dec 28
    // Holiday on Dec 29
    // All should be unavailable
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-8",
        eventDate: new Date("2025-12-27T00:00:00.000Z"),
        endDate: null,
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([
      {
        date: new Date("2025-12-29T00:00:00.000Z"),
      },
    ])
    mockPrisma.reservation.findMany.mockResolvedValue([
      {
        eventDate: new Date("2025-12-28T00:00:00.000Z"),
        endDate: null,
      },
    ])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(false)
    expect(result.unavailableDates.length).toBe(3)
  })

  it("should handle excludeBookingId with multiple bookings", async () => {
    // Two bookings on Dec 27 and Dec 28
    // Exclude booking on Dec 27
    // Dec 27 should be available, Dec 28 unavailable
    mockPrisma.booking.findMany.mockImplementation(async (args: any) => {
      // If excludeBookingId is provided, filter it out
      if (args?.where?.id?.not === "booking-exclude") {
        return [
          {
            id: "booking-keep",
            eventDate: new Date("2025-12-28T00:00:00.000Z"),
            endDate: null,
          },
        ]
      }
      return [
        {
          id: "booking-exclude",
          eventDate: new Date("2025-12-27T00:00:00.000Z"),
          endDate: null,
        },
        {
          id: "booking-keep",
          eventDate: new Date("2025-12-28T00:00:00.000Z"),
          endDate: null,
        },
      ]
    })
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-27",
      "2025-12-29",
      "booking-exclude"
    )

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(true)
  })

  it("should handle excludeReservationId correctly", async () => {
    // Reservation by user-1 on Dec 28
    // When excludeReservationId is res-1, Dec 28 should be available
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockImplementation(async (args: any) => {
      // If excludeReservationId is provided (id.not is set), return empty array
      if (args?.where?.id?.not) {
        return []
      }
      return [
        {
          eventDate: new Date("2025-12-28T00:00:00.000Z"),
          endDate: null,
        },
      ]
    })

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-27",
      "2025-12-29",
      undefined,
      undefined,
      "res-1"
    )

    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.unavailableDates).not.toContain("2025-12-28")

    // Verify the query excluded the reservation ID
    const where = mockPrisma.reservation.findMany.mock.calls[0][0]?.where
    expect(where?.id?.not).toBe("res-1")
  })

  it("should handle excludeReservationId with bookings", async () => {
    // Booking on Dec 27
    // Reservation on Dec 28
    // When excludeReservationId is res-1, Dec 27 unavailable, Dec 28 available
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        eventDate: new Date("2025-12-27T00:00:00.000Z"),
        endDate: null,
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.id?.not) {
        return []
      }
      return [
        {
          eventDate: new Date("2025-12-28T00:00:00.000Z"),
          endDate: null,
        },
      ]
    })

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-27",
      "2025-12-29",
      undefined,
      undefined,
      "res-1"
    )

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
  })

  it("should handle excludeUserId and excludeReservationId together", async () => {
    // Reservation by user-1 on Dec 27
    // Reservation by user-2 on Dec 28
    // When excludeUserId is user-1 and excludeReservationId is res-2, both should be available
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockImplementation(async (args: any) => {
      // If both exclusions are applied, return empty array
      if (args?.where?.userId?.not && args?.where?.id?.not) {
        return []
      }
      // If only userId exclusion, return user-2's reservation
      if (args?.where?.userId?.not === "user-1") {
        return [
          {
            eventDate: new Date("2025-12-28T00:00:00.000Z"),
            endDate: null,
          },
        ]
      }
      // Default: return both reservations
      return [
        {
          eventDate: new Date("2025-12-27T00:00:00.000Z"),
          endDate: null,
        },
        {
          eventDate: new Date("2025-12-28T00:00:00.000Z"),
          endDate: null,
        },
      ]
    })

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-27",
      "2025-12-29",
      undefined,
      "user-1",
      "res-2"
    )

    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
  })

  it("should handle multi-day reservations that span the entire requested range", async () => {
    // Reservation from Dec 26-30, requested range is Dec 27-29
    // All days should be unavailable
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([
      {
        eventDate: new Date("2025-12-26T00:00:00.000Z"),
        endDate: new Date("2025-12-30T00:00:00.000Z"),
      },
    ])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(false)
    expect(result.unavailableDates).toContain("2025-12-27")
    expect(result.unavailableDates).toContain("2025-12-28")
    expect(result.unavailableDates).toContain("2025-12-29")
  })

  it("should handle bookings that exactly match the range boundaries", async () => {
    // Booking exactly matches requested range Dec 27-29
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        eventDate: new Date("2025-12-27T00:00:00.000Z"),
        endDate: new Date("2025-12-29T00:00:00.000Z"),
      },
    ])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])

    const result = await getAvailableWeeks(trackId, "2025-12-27", "2025-12-29", undefined)

    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(false)
  })
})
