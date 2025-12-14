import { prisma } from "@/lib/db/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function AdminDashboard() {
  const [tracksCount, carsCount, bookingsCount] = await Promise.all([
    prisma.track.count(),
    prisma.car.count(),
    prisma.booking.count(),
  ])

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <span className="text-4xl">📊</span>
        Dashboard Overview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🏁</span>
              Tracks
            </CardTitle>
            <CardDescription>Total tracks in inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{tracksCount}</div>
            <Link href="/admin/tracks">
              <Button variant="outline" className="mt-4 w-full">
                Manage Tracks →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🏎️</span>
              Cars
            </CardTitle>
            <CardDescription>Total cars in inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{carsCount}</div>
            <Link href="/admin/cars">
              <Button variant="outline" className="mt-4 w-full">
                Manage Cars →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📈</span>
              Analytics
            </CardTitle>
            <CardDescription>Revenue and top tracks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">Insights</div>
            <Link href="/admin/analytics">
              <Button variant="outline" className="mt-4 w-full">
                View Analytics →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🎟️</span>
              Referrals
            </CardTitle>
            <CardDescription>Issue codes & track redemptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">Growth</div>
            <Link href="/admin/referrals">
              <Button variant="outline" className="mt-4 w-full">
                Manage Referrals →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              Bookings
            </CardTitle>
            <CardDescription>Total bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{bookingsCount}</div>
            <Link href="/admin/bookings">
              <Button variant="outline" className="mt-4 w-full">
                View Bookings →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

