import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { sendEmail } from "@/lib/email/send"

/**
 * POST - Send notification emails to users with abandoned reservations
 * This can be called by a cron job or manually from admin UI
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Check authorization
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    
    // Allow cron secret OR authenticated admin user
    let isAuthorized = false
    
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true
    }

    // If not authorized by cron secret, check session (for admin UI)
    if (!isAuthorized) {
      const session = await getServerSession(authOptions)
      
      if (session?.user?.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
        })
        isAuthorized = user?.role === "ADMIN"
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startTime = Date.now()

    // Find recently expired reservations (expired in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        expiresAt: {
          gte: oneDayAgo,
          lt: new Date(),
        },
      },
      include: {
        user: true,
        track: true,
      },
      take: 50, // Process in batches
    })

    const emailsSent: Array<{ email: string; trackName: string; eventDate: string }> = []
    const errors: Array<{ email: string; error: string }> = []
    const skipped: Array<{ email: string; reason: string }> = []

    for (const reservation of expiredReservations) {
      try {
        // Check if user has completed a booking for this date already
        const completedBooking = await prisma.booking.findFirst({
          where: {
            userId: reservation.userId,
            trackId: reservation.trackId,
            eventDate: reservation.eventDate,
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
        })

        if (completedBooking) {
          skipped.push({
            email: reservation.user.email,
            reason: 'User already completed booking',
          })
          continue
        }

        // Check if date is still available
        const dateStillAvailable = await prisma.booking.count({
          where: {
            trackId: reservation.trackId,
            eventDate: reservation.eventDate,
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
        })

        const dateMessage = dateStillAvailable > 0
          ? '<p><strong>Note:</strong> The date you selected may no longer be available. Please check our calendar for available dates.</p>'
          : '<p>Great news! Your selected date is still available.</p>'

        await sendEmail({
          to: reservation.user.email,
          subject: `Complete Your ${reservation.track.name} Track Rental Booking`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">We noticed you started booking a track rental</h2>
              <p>Hi ${reservation.user.firstName || reservation.user.lastName || 'there'},</p>
              <p>You recently started booking <strong>${reservation.track.name}</strong> for <strong>${new Date(reservation.eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>, but didn't complete the reservation.</p>
              ${dateMessage}
              <p>We'd love to help you complete your booking!</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/book?trackId=${reservation.trackId}" 
                   style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Complete Your Booking
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">If you have any questions or need assistance, please don't hesitate to contact us.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px;">This is an automated reminder for an incomplete booking. If you no longer wish to book, you can ignore this email.</p>
            </div>
          `,
        })

        emailsSent.push({
          email: reservation.user.email,
          trackName: reservation.track.name,
          eventDate: reservation.eventDate.toISOString(),
        })

        // Small delay to avoid overwhelming email service
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to send email to ${reservation.user.email}:`, error)
        errors.push({
          email: reservation.user.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const executionTime = Date.now() - startTime

    console.log(`[CRON] Sent ${emailsSent.length} abandoned cart emails in ${executionTime}ms`)

    return NextResponse.json({
      success: true,
      emailsSent: emailsSent.length,
      errors: errors.length,
      skipped: skipped.length,
      totalProcessed: expiredReservations.length,
      executionTimeMs: executionTime,
      details: {
        emailsSent,
        errors,
        skipped,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error sending abandoned reservation emails:", error)
    return NextResponse.json(
      { 
        error: "Failed to send notification emails",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Get statistics about abandoned reservations
 */
export async function GET(request: NextRequest) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const abandonedCount = await prisma.reservation.count({
      where: {
        expiresAt: {
          gte: oneDayAgo,
          lt: new Date(),
        },
      },
    })

    const abandonedSample = await prisma.reservation.findMany({
      where: {
        expiresAt: {
          gte: oneDayAgo,
          lt: new Date(),
        },
      },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
        track: {
          select: { name: true },
        },
      },
      take: 10,
      orderBy: {
        expiresAt: 'desc',
      },
    })

    return NextResponse.json({
      abandonedInLast24Hours: abandonedCount,
      sample: abandonedSample.map(r => ({
        user: r.user.email,
        track: r.track.name,
        eventDate: r.eventDate,
        expiredAt: r.expiresAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching abandoned reservation stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
