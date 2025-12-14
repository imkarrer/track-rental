import { prisma } from "@/lib/db/prisma"
import { toDateStringUTC } from "@/lib/date/format"

/**
 * Converts a reservation to a booking after successful payment
 */
export async function convertReservationToBooking(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  })

  if (!reservation) {
    throw new Error("Reservation not found")
  }

  if (reservation.expiresAt < new Date()) {
    throw new Error("Reservation has expired")
  }

  // Check again for conflicts (double-check before creating booking)
  // Use string comparison to avoid timezone issues with @db.Date fields
  const resEventDateStr = toDateStringUTC(reservation.eventDate)!
  const resEndDateStr = toDateStringUTC(reservation.endDate || reservation.eventDate)!

  // Fetch all bookings and filter in JS to avoid timezone comparison issues
  const bookings = await prisma.booking.findMany({
    where: {
      trackId: reservation.trackId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      id: true,
      eventDate: true,
      endDate: true,
    },
  })

  // Find matching booking using string comparison to avoid timezone issues
  const existingBooking = bookings.find((booking) => {
    const bookingStartStr = toDateStringUTC(booking.eventDate)!
    const bookingEndStr = toDateStringUTC(booking.endDate || booking.eventDate)!
    
    // Check for overlap: booking overlaps if ranges intersect
    return !(bookingEndStr < resEventDateStr || bookingStartStr > resEndDateStr)
  })

  if (existingBooking) {
    throw new Error("This date is already booked")
  }

  // Create booking from reservation
  const booking = await prisma.booking.create({
    data: {
      userId: reservation.userId,
      trackId: reservation.trackId,
      eventDate: reservation.eventDate,
      endDate: reservation.endDate,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      durationHours: reservation.durationHours,
      eventAddress: reservation.eventAddress,
      eventCity: reservation.eventCity,
      eventState: reservation.eventState,
      eventZip: reservation.eventZip,
      availableSpaceLength: reservation.availableSpaceLength,
      availableSpaceWidth: reservation.availableSpaceWidth,
      distanceFromBase: reservation.distanceFromBase,
      dayOfWeek: reservation.dayOfWeek,
      basePrice: reservation.basePrice,
      dayMultiplier: reservation.dayMultiplier,
      durationMultiplier: reservation.durationMultiplier,
      distanceSurcharge: reservation.distanceSurcharge,
      setupFee: 0,
      freeCarsIncluded: reservation.freeCarsIncluded,
      additionalCarsCount: reservation.additionalCarsCount,
      additionalCarsPrice: reservation.additionalCarsPrice,
      referralCode: reservation.referralCode,
      referralDiscount: reservation.referralDiscount,
      rewardId: reservation.rewardId,
      rewardDiscount: reservation.rewardDiscount,
      subtotal: reservation.subtotal,
      tax: reservation.tax,
      total:
        Number(reservation.total) -
        Number(reservation.referralDiscount || 0) -
        Number(reservation.rewardDiscount || 0),
      status: "PENDING",
      reservationId: reservation.id,
    },
  })

  // Create booking cars from selected cars
  const selectedCars = reservation.selectedCars as Array<{
    carId: string
    quantity: number
  }>

  let freeCarsRemaining = reservation.freeCarsIncluded

  for (const selectedCar of selectedCars) {
    const car = await prisma.car.findUnique({
      where: { id: selectedCar.carId },
    })

    if (!car) continue

    const isFree = freeCarsRemaining > 0
    const quantity = Math.min(selectedCar.quantity, isFree ? freeCarsRemaining : selectedCar.quantity)
    
    if (isFree) {
      freeCarsRemaining -= quantity
    }

    const unitPrice = isFree ? 0 : Number(car.basePricePerDay)
    const totalPrice = unitPrice * quantity

    await prisma.bookingCar.create({
      data: {
        bookingId: booking.id,
        carId: selectedCar.carId,
        quantity,
        isFree,
        unitPrice,
        totalPrice,
      },
    })
  }

  // Delete the reservation
  await prisma.reservation.delete({
    where: { id: reservationId },
  })

  return booking
}

