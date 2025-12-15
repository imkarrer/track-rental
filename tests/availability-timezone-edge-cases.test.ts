import { describe, it, expect, beforeEach, vi } from "vitest"
import { getAvailableWeeks } from "@/lib/availability/check"

const mockPrisma = vi.hoisted(() => ({
  booking: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  holiday: { findMany: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("getAvailableWeeks - timezone edge cases", () => {
  const trackId = "track-1"

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.holiday.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([])
  })

  it("should handle bookings with non-UTC midnight timestamps correctly", async () => {
    // Simulate a booking on 2025-12-27 stored with a time component
    // This could happen if there was a timezone conversion issue
    const bookingDate = new Date("2025-12-27T08:00:00.000Z") // 8 AM UTC (not midnight)
    
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        eventDate: bookingDate,
        endDate: null,
      },
    ])

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-26",
      "2025-12-29",
      undefined
    )

    // December 27 should be marked unavailable regardless of time component
    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.unavailableDates).toContain("2025-12-27")
    
    // December 26 and 28 should still be available
    expect(result.availableDays["2025-12-26"]).toBe(true)
    expect(result.availableDays["2025-12-28"]).toBe(true)
  })

  it("should handle multi-day bookings with time components correctly", async () => {
    // Booking from Dec 27-29 with time components
    const startDate = new Date("2025-12-27T15:30:00.000Z")
    const endDate = new Date("2025-12-29T18:45:00.000Z")
    
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        eventDate: startDate,
        endDate: endDate,
      },
    ])

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-26",
      "2025-12-30",
      undefined
    )

    // All three days (27, 28, 29) should be marked unavailable
    expect(result.availableDays["2025-12-27"]).toBe(false)
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.availableDays["2025-12-29"]).toBe(false)
    
    // Days outside the range should be available
    expect(result.availableDays["2025-12-26"]).toBe(true)
    expect(result.availableDays["2025-12-30"]).toBe(true)
    
    expect(result.unavailableDates).toContain("2025-12-27")
    expect(result.unavailableDates).toContain("2025-12-28")
    expect(result.unavailableDates).toContain("2025-12-29")
  })

  it("should handle booking exactly on December 28 when checking December 28 availability", async () => {
    // User wants to rebook to Dec 28
    // There's an existing booking on Dec 27
    const existingBookingDate = new Date("2025-12-27T00:00:00.000Z")
    
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        eventDate: existingBookingDate,
        endDate: null,
      },
    ])

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-28",
      "2025-12-28",
      undefined
    )

    // December 28 should be available (only Dec 27 is booked)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.unavailableDates).not.toContain("2025-12-28")
  })

  it("should correctly exclude the current booking when modifying", async () => {
    // User has a booking on Dec 27 (ID: booking-123)
    // They want to change it to Dec 28
    // There should be no conflict
    const currentBookingDate = new Date("2025-12-27T00:00:00.000Z")
    
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        eventDate: currentBookingDate,
        endDate: null,
      },
    ])

    // Check availability for Dec 28, excluding the current booking
    const result = await getAvailableWeeks(
      trackId,
      "2025-12-28",
      "2025-12-28",
      "booking-123", // Exclude current booking
      undefined
    )

    // December 28 should be available
    expect(result.availableDays["2025-12-28"]).toBe(true)
    
    // Verify the query excluded the booking ID
    const where = mockPrisma.booking.findMany.mock.calls[0][0]?.where
    expect(where?.id?.not).toBe("booking-123")
  })

  it("should handle adjacent bookings correctly (no off-by-one error)", async () => {
    // Booking on Dec 27
    // User wants Dec 28 (the next day)
    // Should be available
    const booking1 = new Date("2025-12-27T00:00:00.000Z")
    
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        eventDate: booking1,
        endDate: null,
      },
    ])

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-28",
      "2025-12-28",
      undefined
    )

    // December 28 should be available (27 is booked, but not bleeding into 28)
    expect(result.availableDays["2025-12-28"]).toBe(true)
    expect(result.unavailableDates).not.toContain("2025-12-28")
    // Note: 2025-12-27 is outside the requested date range so it won't be in unavailableDates
  })

  it("should handle reservations with time components correctly", async () => {
    // Reservation on Dec 28 with time component
    const reservationDate = new Date("2025-12-28T12:00:00.000Z")
    
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.reservation.findMany.mockResolvedValue([
      {
        eventDate: reservationDate,
        endDate: null,
      },
    ])

    const result = await getAvailableWeeks(
      trackId,
      "2025-12-27",
      "2025-12-29",
      undefined
    )

    // December 28 should be marked unavailable
    expect(result.availableDays["2025-12-28"]).toBe(false)
    expect(result.unavailableDates).toContain("2025-12-28")
    
    // Adjacent days should be available
    expect(result.availableDays["2025-12-27"]).toBe(true)
    expect(result.availableDays["2025-12-29"]).toBe(true)
  })
})
