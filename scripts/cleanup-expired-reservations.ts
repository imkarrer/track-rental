#!/usr/bin/env tsx
/**
 * Cleanup script to remove expired reservations
 * Run this periodically (e.g., via cron job) to clean up expired reservations
 */

import { prisma } from "../lib/db/prisma"

async function cleanupExpiredReservations() {
  try {
    const result = await prisma.reservation.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    console.log(`Cleaned up ${result.count} expired reservation(s)`)
    return result.count
  } catch (error) {
    console.error("Error cleaning up expired reservations:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  cleanupExpiredReservations()
    .then((count) => {
      console.log(`Successfully cleaned up ${count} expired reservation(s)`)
      process.exit(0)
    })
    .catch((error) => {
      console.error("Failed to cleanup reservations:", error)
      process.exit(1)
    })
}

export { cleanupExpiredReservations }

