import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toDateStringUTC } from "@/lib/date/format"
import Link from "next/link"
import { UserBookingsList } from "@/components/booking/user-bookings-list"

export default async function UserBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ modifySuccess?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  const { modifySuccess } = await searchParams
  const showSuccessMessage = modifySuccess === "true"

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    orderBy: { eventDate: "asc" },
    include: { track: true },
  })

  if (!bookings || bookings.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>My Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">You don&apos;t have any bookings yet.</p>
            <Link
              href="/tracks"
              className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Browse Tracks
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const normalized = bookings.map((b) => ({
    id: b.id,
    trackName: b.track?.name ?? "Track",
    trackId: b.trackId,
    eventDate: toDateStringUTC(b.eventDate) ?? "", // YYYY-MM-DD format
    endDate: b.endDate ? toDateStringUTC(b.endDate) : null,
    total: Number(b.total ?? 0),
    status: b.status,
    createdAt: b.createdAt.toISOString(),
  }))

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Success message */}
      {showSuccessMessage && (
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardContent className="py-4">
            <p className="text-green-800 font-semibold flex items-center gap-2">
              <span>✅</span>
              Booking successfully modified!
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <span>📅</span>
          My Bookings
        </h1>
        <p className="text-gray-600">
          Review your upcoming and past bookings. Modify confirmed bookings as needed.
        </p>
      </div>

      <UserBookingsList bookings={normalized} />
    </div>
  )
}

