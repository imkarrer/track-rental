import { describe, it, expect, beforeEach, vi } from "vitest"
import { getAvailableWeeks } from "@/lib/availability/check"

const mockPrisma = vi.hoisted(() => ({
  booking: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  holiday: { findMany: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("getAvailableWeeks - reschedule exclusions", () => {
  const trackId = "track-1"
  const start = "2025-01-01"
  const end = "2025-01-03"
  const heldDate = "2025-01-02"

  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.holiday.findMany.mockResolvedValue([])
    // Mock reservation.findMany to respect the exclusion filter
    mockPrisma.reservation.findMany.mockImplementation(async (args: any) => {
      // If excludeReservationId is provided (id.not is set), return empty array
      if (args?.where?.id?.not) {
        return []
      }
      return [
        {
          eventDate: new Date(`${heldDate}T00:00:00.000Z`),
          endDate: null,
        },
      ]
    })
  })

  it("excludes the caller's reservation when excludeReservationId is provided", async () => {
    const excludeReservationId = "res-keep"

    const result = await getAvailableWeeks(
      trackId,
      start,
      end,
      undefined,
      "user-1",
      excludeReservationId
    )

    // The held date should remain available to the holder
    expect(result.availableDays[heldDate]).toBe(true)
    expect(result.unavailableDates).not.toContain(heldDate)

    // Ensure we filter out the reservation by id
    const where = mockPrisma.reservation.findMany.mock.calls[0][0]?.where
    expect(where?.id?.not).toBe(excludeReservationId)
  })

  it("marks the date unavailable when excludeReservationId is not provided", async () => {
    const result = await getAvailableWeeks(trackId, start, end, undefined, "user-1")

    expect(result.availableDays[heldDate]).toBe(false)
    expect(result.unavailableDates).toContain(heldDate)

    const where = mockPrisma.reservation.findMany.mock.calls[0][0]?.where
    expect(where?.id).toBeUndefined()
  })
})

