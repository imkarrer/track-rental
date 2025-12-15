import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

/**
 * POST - Clean up expired reservations
 * Can be triggered by cron job or manually from admin UI
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
    
    // Find expired reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        expiresAt: {
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
    })

    // Delete expired reservations
    const deleteResult = await prisma.reservation.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    const executionTime = Date.now() - startTime

    // Log the cleanup
    console.log(`[CRON] Cleaned up ${deleteResult.count} expired reservations in ${executionTime}ms`)

    return NextResponse.json({
      success: true,
      deleted: deleteResult.count,
      executionTimeMs: executionTime,
      details: expiredReservations.map(r => ({
        id: r.id,
        user: r.user.email,
        track: r.track.name,
        eventDate: r.eventDate,
        expiredAt: r.expiresAt,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error cleaning up reservations:", error)
    return NextResponse.json(
      { 
        error: "Failed to clean up reservations",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Get cleanup statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Count expired reservations
    const expiredCount = await prisma.reservation.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    // Get sample of expired reservations
    const expiredSample = await prisma.reservation.findMany({
      where: {
        expiresAt: {
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
        expiresAt: 'asc',
      },
    })

    return NextResponse.json({
      expiredCount,
      expiredSample: expiredSample.map(r => ({
        id: r.id,
        user: r.user.email,
        track: r.track.name,
        eventDate: r.eventDate,
        expiredAt: r.expiresAt,
        expiredMinutesAgo: Math.floor((Date.now() - r.expiresAt.getTime()) / 1000 / 60),
      })),
    })
  } catch (error) {
    console.error("Error fetching cleanup stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch cleanup stats" },
      { status: 500 }
    )
  }
}

