import { Booking } from "@prisma/client"

export type ClientBookingSummary = {
  id: string
  total: number
  totalRefunded: number
  status: string
  paymentIntentId: string | null
  eventDate: string
}

/**
 * Prepare a booking for client components by stripping non-serializable values.
 */
export function serializeBookingForClient(
  booking: Pick<
    Booking,
    "id" | "total" | "totalRefunded" | "status" | "paymentIntentId" | "eventDate"
  >
): ClientBookingSummary {
  return {
    id: booking.id,
    total: Number(booking.total),
    totalRefunded: Number(booking.totalRefunded),
    status: booking.status,
    paymentIntentId: booking.paymentIntentId,
    eventDate:
      booking.eventDate instanceof Date
        ? booking.eventDate.toISOString()
        : new Date(booking.eventDate as any).toISOString(),
  }
}


