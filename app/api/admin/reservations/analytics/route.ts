import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

/**
 * GET - Get reservation analytics (admin only)
 * Shows patterns to detect abuse
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin (adjust based on your auth setup)
    // This is a placeholder - update with your actual admin check
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    // Get analytics
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Active reservations
    const activeReservations = await prisma.reservation.findMany({
      where: {
        expiresAt: { gt: now },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        track: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Users with multiple active reservations (potential abuse)
    const usersWithMultipleReservations = await prisma.reservation.groupBy({
      by: ['userId'],
      where: {
        expiresAt: { gt: now },
      },
      _count: true,
      having: {
        userId: {
          _count: {
            gt: 1,
          },
        },
      },
    })

    // Reservation conversion rate (last 7 days)
    const reservationsCreated = await prisma.reservation.count({
      where: {
        createdAt: { gte: last7Days },
      },
    })

    const reservationsConverted = await prisma.booking.count({
      where: {
        createdAt: { gte: last7Days },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    })

    // Users who create many reservations but don't convert
    const suspiciousUsers = await prisma.reservation.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: last7Days },
      },
      _count: true,
      orderBy: {
        _count: {
          userId: 'desc',
        },
      },
      take: 10,
    })

    // Get user details for suspicious users
    const suspiciousUserDetails = await Promise.all(
      suspiciousUsers.map(async (su) => {
        const user = await prisma.user.findUnique({
          where: { id: su.userId },
          select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
        })
        const bookingsCount = await prisma.booking.count({
          where: {
            userId: su.userId,
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
        })
        return {
          user,
          reservationsCount: su._count,
          bookingsCount,
          conversionRate: bookingsCount > 0 ? (bookingsCount / su._count) * 100 : 0,
        }
      })
    )

    return NextResponse.json({
      summary: {
        activeReservations: activeReservations.length,
        usersWithMultipleReservations: usersWithMultipleReservations.length,
        last7DaysConversionRate: reservationsCreated > 0 
          ? ((reservationsConverted / reservationsCreated) * 100).toFixed(1) + '%'
          : 'N/A',
        reservationsCreatedLast7Days: reservationsCreated,
        bookingsCreatedLast7Days: reservationsConverted,
      },
      activeReservations: activeReservations.map(r => ({
        id: r.id,
        user: r.user,
        track: r.track,
        eventDate: r.eventDate,
        expiresAt: r.expiresAt,
        minutesRemaining: Math.floor((r.expiresAt.getTime() - now.getTime()) / 1000 / 60),
      })),
      suspiciousUsers: suspiciousUserDetails,
    })
  } catch (error) {
    console.error("Error fetching reservation analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}

