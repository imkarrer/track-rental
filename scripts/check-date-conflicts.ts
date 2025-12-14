import { PrismaClient } from "@prisma/client"
import { toDateStringUTC } from "../lib/date/format"

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.log("Usage: npx tsx scripts/check-date-conflicts.ts <trackId> <date>")
    console.log("Example: npx tsx scripts/check-date-conflicts.ts <track-id> 2026-06-21")
    process.exit(1)
  }

  const trackId = args[0]
  const dateStr = args[1] // YYYY-MM-DD format

  console.log(`\nChecking conflicts for date ${dateStr} on track ${trackId}\n`)

  // Check bookings
  const bookings = await prisma.booking.findMany({
    where: {
      trackId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      id: true,
      eventDate: true,
      endDate: true,
      status: true,
      userId: true,
    },
  })

  console.log(`Found ${bookings.length} bookings:`)
  for (const booking of bookings) {
    const bookingStartStr = toDateStringUTC(booking.eventDate)!
    const bookingEndStr = toDateStringUTC(booking.endDate || booking.eventDate)!
    
    const overlaps = !(bookingEndStr < dateStr || bookingStartStr > dateStr)
    
    console.log(`  - Booking ${booking.id}:`)
    console.log(`    Date range: ${bookingStartStr} to ${bookingEndStr}`)
    console.log(`    Status: ${booking.status}`)
    console.log(`    User ID: ${booking.userId}`)
    console.log(`    Overlaps ${dateStr}: ${overlaps ? "YES ⚠️" : "NO"}`)
    console.log()
  }

  // Check reservations
  const reservations = await prisma.reservation.findMany({
    where: {
      trackId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      eventDate: true,
      endDate: true,
      userId: true,
      expiresAt: true,
    },
  })

  console.log(`Found ${reservations.length} active reservations:`)
  for (const reservation of reservations) {
    const resStartStr = toDateStringUTC(reservation.eventDate)!
    const resEndStr = toDateStringUTC(reservation.endDate || reservation.eventDate)!
    
    const overlaps = !(resEndStr < dateStr || resStartStr > dateStr)
    
    console.log(`  - Reservation ${reservation.id}:`)
    console.log(`    Date range: ${resStartStr} to ${resEndStr}`)
    console.log(`    User ID: ${reservation.userId}`)
    console.log(`    Expires: ${reservation.expiresAt}`)
    console.log(`    Overlaps ${dateStr}: ${overlaps ? "YES ⚠️" : "NO"}`)
    console.log()
  }
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
