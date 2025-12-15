import { NextResponse } from "next/server"
import { getAvailableWeeks } from "@/lib/availability/check"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const excludeBookingId = searchParams.get("excludeBookingId")
    const excludeUserId = searchParams.get("excludeUserId")
    const excludeReservationId = searchParams.get("excludeReservationId")
    
    // Support custom date range, or default to 3 years ahead
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    let startDate: string
    let endDate: string

    if (startDateParam && endDateParam) {
      // Use provided date range
      startDate = startDateParam
      endDate = endDateParam
    } else {
      // Default: current date to 3 years ahead (to cover bookings far in advance)
      const today = new Date()
      startDate = today.toISOString().split("T")[0]
      
      const threeYearsAhead = new Date(today)
      threeYearsAhead.setFullYear(threeYearsAhead.getFullYear() + 3)
      endDate = threeYearsAhead.toISOString().split("T")[0]
    }

    const { unavailableDates } = await getAvailableWeeks(
      id,
      startDate,
      endDate,
      excludeBookingId || undefined,
      excludeUserId || undefined,
      excludeReservationId || undefined
    )

    return NextResponse.json({
      unavailableDates,
    })
  } catch (error) {
    console.error("Error fetching availability:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
