import "server-only"
import { prisma } from "@/lib/db/prisma"
import { toUTCStartOfDay, toDateStringUTC } from "@/lib/date/format"

/**
 * Get available weeks for a track, checking bookings and holidays.
 * Returns available and unavailable dates.
 * 
 * SERVER-SIDE ONLY - Do not import in client components
 */
export async function getAvailableWeeks(
  trackId: string,
  startDateStr: string,
  endDateStr: string,
  excludeBookingId?: string,
  excludeUserId?: string,
  excludeReservationId?: string
): Promise<{
  availableDays: Record<string, boolean>
  unavailableDates: string[]
}> {
  // Use string dates for comparison to avoid timezone issues with @db.Date fields
  // Parse the date strings to get Date objects only for building the available days map
  const startDate = toUTCStartOfDay(startDateStr)
  const endDate = toUTCStartOfDay(endDateStr)

  // Fetch all bookings for this track
  // Note: We fetch all and filter in JS to avoid timezone comparison issues with @db.Date
  const bookings = await prisma.booking.findMany({
    where: {
      trackId,
      status: { in: ["CONFIRMED", "PENDING"] },
      // Exclude a specific booking if provided (for modify/reschedule flow)
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
    },
    select: {
      id: true,
      eventDate: true,
      endDate: true,
    },
  })

  // Fetch holidays
  const holidays = await prisma.holiday.findMany({
    where: {
      isActive: true,
    },
    select: {
      date: true,
    },
  })

  // Build set of unavailable dates
  const unavailableSet = new Set<string>()

  // Fetch active reservations (non-expired) for this track
  const reservations = await prisma.reservation.findMany({
    where: {
      trackId,
      expiresAt: { gt: new Date() },
      ...(excludeUserId && { userId: { not: excludeUserId } }),
      ...(excludeReservationId && { id: { not: excludeReservationId } }),
    },
    select: {
      eventDate: true,
      endDate: true,
    },
  })

  // Add booked dates
  // Filter bookings to only those that overlap with our date range
  for (const booking of bookings) {
    const bookingStartStr = toDateStringUTC(booking.eventDate)!
    const bookingEndStr = toDateStringUTC(booking.endDate || booking.eventDate)!
    
    // Skip bookings outside our date range (using string comparison to avoid timezone issues)
    if (bookingEndStr < startDateStr || bookingStartStr > endDateStr) {
      continue
    }

    // Add each day in the booking to unavailable set
    const bookingStart = toUTCStartOfDay(bookingStartStr)
    const bookingEnd = toUTCStartOfDay(bookingEndStr)

    let current = new Date(bookingStart)
    while (current <= bookingEnd) {
      unavailableSet.add(toDateStringUTC(current)!)
      current.setUTCDate(current.getUTCDate() + 1)
    }
  }

  // Add reserved dates
  // Filter reservations to only those that overlap with our date range
  for (const reservation of reservations) {
    const resStartStr = toDateStringUTC(reservation.eventDate)!
    const resEndStr = toDateStringUTC(reservation.endDate || reservation.eventDate)!
    
    // Skip reservations outside our date range (using string comparison to avoid timezone issues)
    if (resEndStr < startDateStr || resStartStr > endDateStr) {
      continue
    }

    // Add each day in the reservation to unavailable set
    const resStart = toUTCStartOfDay(resStartStr)
    const resEnd = toUTCStartOfDay(resEndStr)

    let current = new Date(resStart)
    while (current <= resEnd) {
      unavailableSet.add(toDateStringUTC(current)!)
      current.setUTCDate(current.getUTCDate() + 1)
    }
  }

  // Add holidays
  // Filter holidays to only those in our date range
  for (const holiday of holidays) {
    const holidayStr = toDateStringUTC(holiday.date)!
    
    // Skip holidays outside our date range (using string comparison)
    if (holidayStr < startDateStr || holidayStr > endDateStr) {
      continue
    }
    
    unavailableSet.add(holidayStr)
  }

  // Build available days map
  const availableDays: Record<string, boolean> = {}
  let current = new Date(startDate)
  
  while (current <= endDate) {
    const dateStr = toDateStringUTC(current)!
    availableDays[dateStr] = !unavailableSet.has(dateStr)
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return {
    availableDays,
    unavailableDates: Array.from(unavailableSet),
  }
}

