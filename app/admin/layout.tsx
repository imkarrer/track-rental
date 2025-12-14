import { requireAdmin } from "@/lib/auth/middleware"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <Link href="/">
              <Button variant="outline" size="sm">
                Back to Site
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          <aside className="w-64 bg-white rounded-lg shadow-sm p-4 h-fit">
            <nav className="space-y-1">
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">🏠</span>
                <span>Dashboard</span>
              </Link>
              <Link
                href="/admin/tracks"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">🏁</span>
                <span>Manage Tracks</span>
              </Link>
              <Link
                href="/admin/cars"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">🏎️</span>
                <span>Manage Cars</span>
              </Link>
              <Link
                href="/admin/bookings"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">📅</span>
                <span>Bookings</span>
              </Link>
              <Link
                href="/admin/fixed-costs"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">💰</span>
                <span>Fixed Costs</span>
              </Link>
              <Link
                href="/admin/batteries"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">🔋</span>
                <span>Battery Management</span>
              </Link>
              <Link
                href="/admin/chargers"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">⚡</span>
                <span>Charger Management</span>
              </Link>
              <Link
                href="/admin/day-multipliers"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">📈</span>
                <span>Day Multipliers</span>
              </Link>
              <Link
                href="/admin/holiday-rules"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">🎉</span>
                <span>Smart Holidays</span>
              </Link>
              <Link
                href="/admin/refund-policies"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">↩️</span>
                <span>Refund Policies</span>
              </Link>
              <div className="my-2 border-t border-gray-200"></div>
              <Link
                href="/admin/cron-jobs"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">⚙️</span>
                <span>Cron Jobs</span>
              </Link>
              <Link
                href="/admin/reservations/analytics"
                className="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">📊</span>
                <span>Analytics</span>
              </Link>
            </nav>
          </aside>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}

