import { prisma } from "../lib/db/prisma"
import { convertReservationToBooking } from "../lib/reservations/convert-to-booking"

/**
 * Manually convert pending reservations to bookings
 * Useful for fixing stuck reservations in local development
 */
async function convertPendingReservations() {
  try {
    console.log("Finding pending reservations...")
    
    const reservations = await prisma.reservation.findMany({
      where: {
        expiresAt: {
          gte: new Date(), // Not expired
        },
      },
      include: {
        user: true,
        track: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    console.log(`Found ${reservations.length} active reservations`)

    if (reservations.length === 0) {
      console.log("No active reservations to convert")
      return
    }

    for (const reservation of reservations) {
      console.log(`\nReservation ${reservation.id}:`)
      console.log(`  User: ${reservation.user.email}`)
      console.log(`  Track: ${reservation.track.name}`)
      console.log(`  Date: ${reservation.eventDate.toISOString().split('T')[0]}`)
      console.log(`  Expires: ${reservation.expiresAt.toISOString()}`)
      
      const answer = await askQuestion(`  Convert this reservation to a booking? (y/n): `)
      
      if (answer.toLowerCase() === 'y') {
        try {
          const booking = await convertReservationToBooking(reservation.id)
          
          // Update booking status to CONFIRMED (simulate successful payment)
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: "CONFIRMED",
              paymentIntentId: `manual_${Date.now()}`, // Dummy payment intent
            },
          })
          
          console.log(`  ✅ Successfully converted to booking ${booking.id}`)
          console.log(`     Status set to CONFIRMED`)
        } catch (error) {
          console.error(`  ❌ Error converting reservation:`, error)
        }
      } else {
        console.log(`  ⏭️  Skipped`)
      }
    }

    console.log("\n✅ Done!")
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

function askQuestion(question: string): Promise<string> {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close()
      resolve(answer)
    })
  })
}

convertPendingReservations()
