"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { formatDateUTC } from "@/lib/date/format"

interface AnalyticsData {
  summary: {
    activeReservations: number
    usersWithMultipleReservations: number
    last7DaysConversionRate: string
    reservationsCreatedLast7Days: number
    bookingsCreatedLast7Days: number
  }
  activeReservations: Array<{
    id: string
    user: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string
    }
    track: {
      id: string
      name: string
    }
    eventDate: Date
    expiresAt: Date
    minutesRemaining: number
  }>
  suspiciousUsers: Array<{
    user: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string
      createdAt: Date
    }
    reservationsCount: number
    bookingsCount: number
    conversionRate: number
  }>
}

export default function ReservationAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch("/api/admin/reservations/analytics")
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error("Error fetching analytics:", err)
      setError(err instanceof Error ? err.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800 font-semibold">Error loading analytics</p>
            <p className="text-red-600 text-sm mt-2">{error}</p>
            <Button onClick={fetchAnalytics} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Reservation Analytics</h1>
          <p className="text-gray-600">Monitor reservation patterns and detect potential abuse</p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.activeReservations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Multiple Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {data.summary.usersWithMultipleReservations}
            </div>
            <p className="text-xs text-gray-500 mt-1">users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {data.summary.last7DaysConversionRate}
            </div>
            <p className="text-xs text-gray-500 mt-1">last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.reservationsCreatedLast7Days}</div>
            <p className="text-xs text-gray-500 mt-1">last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{data.summary.bookingsCreatedLast7Days}</div>
            <p className="text-xs text-gray-500 mt-1">last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Reservations</CardTitle>
            <CardDescription>Currently active reservation holds</CardDescription>
          </CardHeader>
          <CardContent>
            {data.activeReservations.length === 0 ? (
              <p className="text-gray-500 text-sm">No active reservations</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.activeReservations.map((reservation) => (
                  <div key={reservation.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm">{reservation.user.email}</p>
                        <p className="text-xs text-gray-600">{reservation.track.name}</p>
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded ${
                        reservation.minutesRemaining < 3 
                          ? 'bg-red-100 text-red-800' 
                          : reservation.minutesRemaining < 5
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {reservation.minutesRemaining} min left
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Event: {formatDateUTC(reservation.eventDate)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Expires: {new Date(reservation.expiresAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suspicious Activity</CardTitle>
            <CardDescription>Users with low conversion rates (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.suspiciousUsers.length === 0 ? (
              <p className="text-gray-500 text-sm">No suspicious activity detected</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.suspiciousUsers.map((item, i) => {
                  const fullName = [item.user.firstName, item.user.lastName].filter(Boolean).join(' ')
                  return (
                    <div key={i} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-sm">{item.user.email}</p>
                          <p className="text-xs text-gray-600">
                            {fullName || 'No name'}
                          </p>
                        </div>
                        <div className={`text-xs font-medium px-2 py-1 rounded ${
                          item.conversionRate === 0
                            ? 'bg-red-100 text-red-800'
                            : item.conversionRate < 25
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.conversionRate.toFixed(0)}% conversion
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Reservations:</span>
                          <span className="font-semibold ml-1">{item.reservationsCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Bookings:</span>
                          <span className="font-semibold ml-1">{item.bookingsCount}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Member since: {formatDateUTC(item.user.createdAt)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>Understanding the Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong className="text-blue-900">Conversion Rate:</strong>
            <p className="text-gray-700">Percentage of reservations that become completed bookings. Healthy: 40-60%. Low rates may indicate UX issues or potential abuse.</p>
          </div>
          <div>
            <strong className="text-blue-900">Multiple Reservations:</strong>
            <p className="text-gray-700">Users currently holding 2+ active reservations. May indicate date hoarding (limited to 3 max by rate limiter).</p>
          </div>
          <div>
            <strong className="text-blue-900">Suspicious Activity:</strong>
            <p className="text-gray-700">Users who create many reservations but rarely complete bookings. Investigate if conversion rate is 0% or very low.</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-4">
        <Button onClick={() => router.push("/admin/cron-jobs")} variant="outline">
          Cron Jobs & Maintenance
        </Button>
        <Button onClick={() => router.push("/admin")} variant="outline">
          Back to Admin
        </Button>
      </div>
    </div>
  )
}
