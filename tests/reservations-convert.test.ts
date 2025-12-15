import { describe, it, expect, beforeEach, vi } from "vitest"
import { convertReservationToBooking } from "@/lib/reservations/convert-to-booking"

const mockPrisma = vi.hoisted(() => ({
  reservation: { findUnique: vi.fn(), delete: vi.fn() },
  booking: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  car: { findUnique: vi.fn() },
  bookingCar: { create: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

const baseReservation = {
  id: "res-1",
  userId: "user-1",
  trackId: "track-1",
  eventDate: new Date("2025-12-20"),
  endDate: new Date("2025-12-20"),
  startTime: "10:00",
  endTime: "14:00",
  durationHours: 4,
  eventAddress: "123 Track St",
  eventCity: "Tracktown",
  eventState: "TS",
  eventZip: "12345",
  availableSpaceLength: 50,
  availableSpaceWidth: 25,
  distanceFromBase: 12,
  dayOfWeek: 6,
  basePrice: 300,
  dayMultiplier: 1.2,
  durationMultiplier: 1,
  distanceSurcharge: 25,
  setupFee: 0,
  freeCarsIncluded: 1,
  additionalCarsCount: 1,
  additionalCarsPrice: 60,
  subtotal: 385,
  tax: 30,
  total: 415,
  selectedCars: [
    { carId: "car-1", quantity: 2 },
    { carId: "car-2", quantity: 1 },
  ],
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
}

describe("convertReservationToBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.booking.findFirst.mockResolvedValue(null)
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.booking.create.mockImplementation(async ({ data }: any) => ({ id: "booking-1", ...data }))
    mockPrisma.reservation.delete.mockResolvedValue(undefined)
    mockPrisma.car.findUnique.mockResolvedValue({ id: "car-1", basePricePerDay: 40 })
    mockPrisma.bookingCar.create.mockResolvedValue(undefined)
  })

  it("converts a reservation and transfers selected cars, honoring free cars", async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation)

    // car-1 then car-2
    mockPrisma.car.findUnique
      .mockResolvedValueOnce({ id: "car-1", basePricePerDay: 50 })
      .mockResolvedValueOnce({ id: "car-2", basePricePerDay: 30 })

    const booking = await convertReservationToBooking("res-1")

    expect(booking.id).toBe("booking-1")
    expect(mockPrisma.booking.create).toHaveBeenCalled()
    expect(mockPrisma.bookingCar.create).toHaveBeenCalledTimes(2)

    const [firstCall, secondCall] = mockPrisma.bookingCar.create.mock.calls
    expect(firstCall[0].data.isFree).toBe(true)
    expect(firstCall[0].data.quantity).toBe(1)
    expect(firstCall[0].data.unitPrice).toBe(0)

    expect(secondCall[0].data.isFree).toBe(false)
    expect(secondCall[0].data.unitPrice).toBe(30)
    expect(mockPrisma.reservation.delete).toHaveBeenCalledWith({ where: { id: "res-1" } })
  })

  it("throws when reservation is not found", async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(null)

    await expect(convertReservationToBooking("missing")).rejects.toThrow("Reservation not found")
    expect(mockPrisma.booking.create).not.toHaveBeenCalled()
  })

  it("throws when the reservation is expired", async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue({
      ...baseReservation,
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(convertReservationToBooking("expired")).rejects.toThrow("Reservation has expired")
    expect(mockPrisma.booking.create).not.toHaveBeenCalled()
  })

  it("throws when there is a conflicting booking", async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation)
    mockPrisma.booking.findMany.mockResolvedValue([{ id: "existing", eventDate: new Date("2025-12-20"), endDate: null }])

    await expect(convertReservationToBooking("res-1")).rejects.toThrow("This date is already booked")
    expect(mockPrisma.booking.create).not.toHaveBeenCalled()
  })
})


