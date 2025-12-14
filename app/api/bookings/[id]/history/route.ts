import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

/**
 * GET /api/bookings/[id]/history
 * 
 * Fetch the complete history of changes for a specific booking.
 * Returns chronologically ordered list of all modifications, cancellations, etc.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: bookingId } = await params

    // Fetch the booking to verify ownership
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Security: only the booking owner or admin can view history
    const isOwner = booking.userId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch all history entries for this booking
    const history = await prisma.bookingHistory.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" }, // Chronological order
    })

    // Format the response
    const formattedHistory = history.map((entry) => ({
      id: entry.id,
      actionType: entry.actionType,
      performedBy: entry.performedBy,
      performedByRole: entry.performedByRole,
      oldEventDate: entry.oldEventDate?.toISOString().split("T")[0],
      oldEndDate: entry.oldEndDate?.toISOString().split("T")[0],
      oldTotal: entry.oldTotal ? Number(entry.oldTotal) : null,
      oldStatus: entry.oldStatus,
      newEventDate: entry.newEventDate?.toISOString().split("T")[0],
      newEndDate: entry.newEndDate?.toISOString().split("T")[0],
      newTotal: entry.newTotal ? Number(entry.newTotal) : null,
      newStatus: entry.newStatus,
      refundAmount: entry.refundAmount ? Number(entry.refundAmount) : null,
      paymentAmount: entry.paymentAmount ? Number(entry.paymentAmount) : null,
      refundPercent: entry.refundPercent ? Number(entry.refundPercent) : null,
      reason: entry.reason,
      notes: entry.notes,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
    }))

    // Calculate summary statistics
    const summary = {
      totalChanges: history.length,
      modifications: history.filter(h => 
        h.actionType === "MODIFIED_DATE" || 
        h.actionType === "MODIFIED_CARS" || 
        h.actionType === "MODIFIED_BOTH"
      ).length,
      cancellations: history.filter(h => h.actionType === "CANCELLED").length,
      totalRefunds: history.reduce((sum, h) => 
        sum + (h.refundAmount ? Number(h.refundAmount) : 0), 0
      ),
      totalPayments: history.reduce((sum, h) => 
        sum + (h.paymentAmount ? Number(h.paymentAmount) : 0), 0
      ),
    }

    return NextResponse.json({
      success: true,
      history: formattedHistory,
      summary,
    })
  } catch (error) {
    console.error("Error fetching booking history:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
