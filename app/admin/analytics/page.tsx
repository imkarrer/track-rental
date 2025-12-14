import { prisma } from "@/lib/db/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function fmtCurrency(value: unknown) {
  return `$${Number(value || 0).toFixed(2)}`
}

export default async function AdminAnalyticsPage() {
  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [totals, last30Agg, statusCounts, upcomingCount, topTracksRaw] = await Promise.all([
    prisma.booking.aggregate({
      _sum: { total: true, totalRefunded: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { createdAt: { gte: last30 } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.booking.count({
      where: { eventDate: { gte: today } },
    }),
    prisma.booking.groupBy({
      by: ["trackId"],
      _count: { trackId: true },
      _sum: { total: true },
      orderBy: { _count: { trackId: "desc" } },
      take: 5,
    }),
  ])

  const topTrackIds = topTracksRaw.map((t) => t.trackId)
  const trackMap = topTrackIds.length
    ? Object.fromEntries(
        (await prisma.track.findMany({ where: { id: { in: topTrackIds } } })).map((t) => [
          t.id,
          t.name,
        ])
      )
    : {}

  const netRevenue = Number(totals._sum.total || 0) - Number(totals._sum.totalRefunded || 0)
  const avgBookingValue =
    totals._count > 0 ? Number(totals._sum.total || 0) / Number(totals._count) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-gray-600 text-sm">Revenue, volume, and top tracks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total Revenue</CardTitle>
            <CardDescription>Gross to date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {fmtCurrency(totals._sum.total)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Net After Refunds</CardTitle>
            <CardDescription>Gross minus refunds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{fmtCurrency(netRevenue)}</div>
            {Number(totals._sum.totalRefunded || 0) > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Refunds: {fmtCurrency(totals._sum.totalRefunded)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Bookings (all time)</CardTitle>
            <CardDescription>Count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{totals._count}</div>
            <p className="text-xs text-gray-500 mt-1">
              Avg booking value: {fmtCurrency(avgBookingValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Last 30 Days</CardTitle>
            <CardDescription>Volume & revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-indigo-700">
              {last30Agg._count} bookings
            </div>
            <p className="text-sm text-gray-600">
              {fmtCurrency(last30Agg._sum.total)} gross
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Bookings by Status</CardTitle>
            <CardDescription>Current distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusCounts.map((s) => (
              <div key={s.status} className="flex justify-between items-center border rounded px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      s.status === "CONFIRMED"
                        ? "default"
                        : s.status === "CANCELLED"
                        ? "destructive"
                        : s.status === "COMPLETED"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <div className="text-sm font-semibold">{s._count._all}</div>
              </div>
            ))}
            {upcomingCount > 0 && (
              <p className="text-xs text-gray-500 pt-2">
                Upcoming (event date ≥ today): {upcomingCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Tracks by Bookings</CardTitle>
            <CardDescription>Top 5, by count (sum of totals)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topTracksRaw.length === 0 ? (
              <p className="text-sm text-gray-500">No bookings yet</p>
            ) : (
              topTracksRaw.map((t) => (
                <div key={t.trackId} className="flex justify-between items-center border rounded px-3 py-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {trackMap[t.trackId] || t.trackId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t._count.trackId} bookings • {fmtCurrency(t._sum.total)}
                    </p>
                  </div>
                  <Badge variant="outline">#{t._count.trackId}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


