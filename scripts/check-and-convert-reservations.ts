import { prisma } from "../lib/db/prisma"
import { convertReservationToBooking } from "../lib/reservations/convert-to-booking"

/**
 * Check for pending reservations and convert them to bookings
 * Useful for fixing stuck reservations in local development
 */
async function checkAndConvertReservations() {
  try {
    console.log("Finding all reservations (including expired)...")
    
    const reservations = await prisma.reservation.findMany({
      include: {
        user: true,
        track: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    console.log(`Found ${reservations.length} total reservations`)

    if (reservations.length === 0) {
      console.log("No reservations found in database")
      return
    }

    const now = new Date()

    for (const reservation of reservations) {
      const isExpired = reservation.expiresAt < now
      console.log(`\nReservation ${reservation.id}:`)
      console.log(`  User: ${reservation.user.email} (${reservation.user.firstName} ${reservation.user.lastName})`)
      console.log(`  Track: ${reservation.track.name}`)
      console.log(`  Event Date: ${reservation.eventDate.toISOString().split('T')[0]}`)
      console.log(`  Created: ${reservation.createdAt.toISOString()}`)
      console.log(`  Expires: ${reservation.expiresAt.toISOString()}`)
      console.log(`  Status: ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`)
      
      // Convert even if expired (for testing purposes)
      try {
        console.log(`  Converting to booking...`)
        const booking = await convertReservationToBooking(reservation.id)
        
        // Update booking status to CONFIRMED (simulate successful payment)
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "CONFIRMED",
            paymentIntentId: `manual_${Date.now()}`, // Dummy payment intent
            phone: reservation.user.phone || "",
          },
        })
        
        console.log(`  ✅ Successfully converted to booking ${booking.id}`)
        console.log(`     Status: CONFIRMED`)
      } catch (error) {
        if (error instanceof Error && error.message.includes("expired")) {
          console.log(`  ⚠️  Cannot convert: ${error.message}`)
          console.log(`     Consider extending expiry or recreating booking`)
        } else {
          console.error(`  ❌ Error:`, error)
        }
      }
    }

    console.log("\n✅ Check complete!")
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAndConvertReservations()
