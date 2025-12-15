import { prisma } from "@/lib/db/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDateUTC } from "@/lib/date/format"
import { ReminderSchedule } from "@/components/admin/reminder-schedule"

// Mark as dynamic to prevent prerendering (requires auth and database)
export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    include: {
      user: true,
      track: true,
      history: {
        select: {
          id: true,
          actionType: true,
          oldEventDate: true,
          newEventDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1, // Just need to know if there are modifications
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Bookings</h2>

      <div className="mb-6">
        <ReminderSchedule />
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No bookings found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      Booking #{booking.id.slice(0, 8)} - {booking.track.name}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDateUTC(booking.eventDate)} at {booking.startTime} - {booking.endTime}
                    </p>
                    {booking.history.length > 0 && booking.history[0].actionType.startsWith("MODIFIED") && (
                      <p className="text-xs text-amber-600 mt-1">
                        ✏️ Modified: Originally {booking.history[0].oldEventDate ? formatDateUTC(booking.history[0].oldEventDate) : "N/A"}
                      </p>
                    )}
                  </div>
                  <Link href={`/admin/bookings/${booking.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Customer: </span>
                    {booking.user.firstName} {booking.user.lastName}
                  </div>
                  <div>
                    <span className="font-semibold">Email: </span>
                    {booking.user.email}
                  </div>
                  <div>
                    <span className="font-semibold">Total: </span>
                    ${Number(booking.total).toFixed(2)}
                  </div>
                  {Number(booking.totalRefunded) > 0 && (
                    <div>
                      <span className="font-semibold">Refunded: </span>
                      <span className="text-red-600">
                        -${Number(booking.totalRefunded).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">Status: </span>
                    <Badge
                      variant={
                        booking.status === "CONFIRMED"
                          ? "default"
                          : booking.status === "CANCELLED"
                          ? "destructive"
                          : booking.status === "COMPLETED"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {booking.status}
                    </Badge>
                    {/* @ts-ignore - confirmationSource may not be in type yet */}
                    {booking.confirmationSource === 'fallback' && (
                      <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                        ⚠️ Fallback
                      </Badge>
                    )}
                    {booking.history.length > 0 && booking.history[0].actionType.startsWith("MODIFIED") && (
                      <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-300">
                        ✏️ Modified
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

