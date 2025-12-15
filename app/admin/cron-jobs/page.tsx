"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { formatDateUTC } from "@/lib/date/format"

interface CronJobResult {
  success: boolean
  executionTimeMs: number
  timestamp: string
  [key: string]: any
}

export default function AdminCronJobsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cleanupStats, setCleanupStats] = useState<any>(null)
  const [abandonedStats, setAbandonedStats] = useState<any>(null)
  const [reminderStats, setReminderStats] = useState<any>(null)
  const [cleanupResult, setCleanupResult] = useState<CronJobResult | null>(null)
  const [abandonedResult, setAbandonedResult] = useState<CronJobResult | null>(null)
  const [reminderResult, setReminderResult] = useState<CronJobResult | null>(null)
  const [runningCleanup, setRunningCleanup] = useState(false)
  const [runningAbandoned, setRunningAbandoned] = useState(false)
  const [runningReminders, setRunningReminders] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    
    if (status === "unauthenticated") {
      router.push("/auth/login")
      return
    }

    // TODO: Add admin role check here
    // For now, just load the data
    fetchStats()
  }, [status, router])

  const fetchStats = async () => {
    try {
      const [cleanupRes, abandonedRes, reminderRes] = await Promise.all([
        fetch("/api/cron/cleanup-reservations"),
        fetch("/api/reservations/abandoned/notify"),
        fetch("/api/cron/reminders"),
      ])

      if (cleanupRes.ok) {
        const cleanupData = await cleanupRes.json()
        setCleanupStats(cleanupData)
      }

      if (abandonedRes.ok) {
        const abandonedData = await abandonedRes.json()
        setAbandonedStats(abandonedData)
      }

      if (reminderRes.ok) {
        const reminderData = await reminderRes.json()
        setReminderStats(reminderData)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const runCleanup = async () => {
    setRunningCleanup(true)
    setCleanupResult(null)
    
    try {
      const response = await fetch("/api/cron/cleanup-reservations", {
        method: "POST",
      })
      
      const result = await response.json()
      setCleanupResult(result)
      
      // Refresh stats
      await fetchStats()
    } catch (error) {
      console.error("Error running cleanup:", error)
      setCleanupResult({
        success: false,
        executionTimeMs: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setRunningCleanup(false)
    }
  }

  const runAbandonedEmails = async () => {
    setRunningAbandoned(true)
    setAbandonedResult(null)
    
    try {
      const response = await fetch("/api/reservations/abandoned/notify", {
        method: "POST",
      })
      
      const result = await response.json()
      setAbandonedResult(result)
      
      // Refresh stats
      await fetchStats()
    } catch (error) {
      console.error("Error sending abandoned emails:", error)
      setAbandonedResult({
        success: false,
        executionTimeMs: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setRunningAbandoned(false)
    }
  }

  const runReminders = async () => {
    setRunningReminders(true)
    setReminderResult(null)
    
    try {
      const response = await fetch("/api/cron/reminders", {
        method: "POST",
      })
      
      const result = await response.json()
      setReminderResult(result)
      
      // Refresh stats
      await fetchStats()
    } catch (error) {
      console.error("Error sending reminders:", error)
      setReminderResult({
        success: false,
        executionTimeMs: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setRunningReminders(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Cron Jobs & Maintenance</h1>
        <p className="text-gray-600">Run scheduled tasks manually and view statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cleanup Expired Reservations */}
        <Card>
          <CardHeader>
            <CardTitle>🗑️ Cleanup Expired Reservations</CardTitle>
            <CardDescription>
              Remove reservations that have expired (older than 10 minutes)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cleanupStats && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Expired Reservations:</span>
                  <span className="text-sm font-bold text-red-600">
                    {cleanupStats.expiredCount}
                  </span>
                </div>
                {cleanupStats.expiredSample?.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-600 mb-2">Sample (up to 10):</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {cleanupStats.expiredSample.map((item: any, i: number) => (
                        <div key={i} className="text-xs bg-white p-2 rounded border">
                          <div className="font-medium">{item.user}</div>
                          <div className="text-gray-600">{item.track} - {formatDateUTC(item.eventDate)}</div>
                          <div className="text-gray-500">Expired {item.expiredMinutesAgo}m ago</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={runCleanup} 
              disabled={runningCleanup}
              className="w-full"
              size="lg"
            >
              {runningCleanup ? "Running..." : "Run Cleanup Now"}
            </Button>

            {cleanupResult && (
              <div className={`p-4 rounded-lg ${cleanupResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`font-semibold ${cleanupResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {cleanupResult.success ? '✅ Success' : '❌ Failed'}
                  </span>
                  <span className="text-xs text-gray-600">
                    {cleanupResult.executionTimeMs}ms
                  </span>
                </div>
                {cleanupResult.success ? (
                  <div className="space-y-1 text-sm text-green-700">
                    <div><strong>{cleanupResult.deleted}</strong> reservations deleted</div>
                    <div className="text-xs text-gray-600">{new Date(cleanupResult.timestamp).toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="text-sm text-red-700">{cleanupResult.error}</div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t">
              <strong>Scheduled:</strong> Every 15 minutes (via cron)
            </div>
          </CardContent>
        </Card>

        {/* Abandoned Cart Emails */}
        <Card>
          <CardHeader>
            <CardTitle>📧 Abandoned Cart Emails</CardTitle>
            <CardDescription>
              Send recovery emails to users who didn&apos;t complete booking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {abandonedStats && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Abandoned (Last 24h):</span>
                  <span className="text-sm font-bold text-orange-600">
                    {abandonedStats.abandonedInLast24Hours}
                  </span>
                </div>
                {abandonedStats.sample?.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-600 mb-2">Sample (up to 10):</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {abandonedStats.sample.map((item: any, i: number) => (
                        <div key={i} className="text-xs bg-white p-2 rounded border">
                          <div className="font-medium">{item.user}</div>
                          <div className="text-gray-600">{item.track} - {new Date(item.eventDate).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={runAbandonedEmails} 
              disabled={runningAbandoned || abandonedStats?.abandonedInLast24Hours === 0}
              className="w-full"
              size="lg"
            >
              {runningAbandoned ? "Sending Emails..." : "Send Emails Now"}
            </Button>

            {abandonedResult && (
              <div className={`p-4 rounded-lg ${abandonedResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`font-semibold ${abandonedResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {abandonedResult.success ? '✅ Success' : '❌ Failed'}
                  </span>
                  <span className="text-xs text-gray-600">
                    {abandonedResult.executionTimeMs}ms
                  </span>
                </div>
                {abandonedResult.success ? (
                  <div className="space-y-1 text-sm text-green-700">
                    <div><strong>{abandonedResult.emailsSent}</strong> emails sent</div>
                    <div><strong>{abandonedResult.skipped}</strong> skipped</div>
                    {abandonedResult.errors > 0 && (
                      <div className="text-red-600"><strong>{abandonedResult.errors}</strong> errors</div>
                    )}
                    <div className="text-xs text-gray-600 mt-2">{new Date(abandonedResult.timestamp).toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="text-sm text-red-700">{abandonedResult.error}</div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t">
              <strong>Scheduled:</strong> Daily at 10:00 AM (via cron)
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Event Reminders */}
        <Card>
          <CardHeader>
            <CardTitle>📱 Upcoming Event Reminders</CardTitle>
            <CardDescription>
              Send email & SMS reminders 3 days and 1 day before events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reminderStats && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">In 3 Days:</span>
                  <span className="text-sm font-bold text-blue-600">
                    {reminderStats.upcomingIn3Days ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Tomorrow:</span>
                  <span className="text-sm font-bold text-blue-600">
                    {reminderStats.upcomingIn1Day ?? 0}
                  </span>
                </div>
              </div>
            )}

            <Button 
              onClick={runReminders} 
              disabled={runningReminders}
              className="w-full"
              size="lg"
            >
              {runningReminders ? "Sending Reminders..." : "Send Reminders Now"}
            </Button>

            {reminderResult && (
              <div className={`p-4 rounded-lg ${reminderResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`font-semibold ${reminderResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {reminderResult.success ? '✅ Success' : '❌ Failed'}
                  </span>
                  <span className="text-xs text-gray-600">
                    {reminderResult.executionTimeMs}ms
                  </span>
                </div>
                {reminderResult.success ? (
                  <div className="space-y-1 text-sm text-green-700">
                    <div><strong>{reminderResult.bookingsProcessed}</strong> bookings processed</div>
                    <div><strong>{reminderResult.emailsSent}</strong> emails sent</div>
                    <div><strong>{reminderResult.smsSent}</strong> SMS sent</div>
                    <div><strong>{reminderResult.skipped}</strong> skipped</div>
                    {reminderResult.errors > 0 && (
                      <div className="text-red-600"><strong>{reminderResult.errors}</strong> errors</div>
                    )}
                    <div className="text-xs text-gray-600 mt-2">{new Date(reminderResult.timestamp).toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="text-sm text-red-700">{reminderResult.error}</div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t">
              <strong>Scheduled:</strong> Daily at 9:00 AM (via cron)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>⚡ Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/reservations/analytics")}
            >
              📊 View Analytics
            </Button>
            <Button
              variant="outline"
              onClick={fetchStats}
            >
              🔄 Refresh Stats
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/admin")}
            >
              ← Back to Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>🔧 Automated Cron Setup</CardTitle>
          <CardDescription>
            Set these up to run automatically without manual intervention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Using Vercel Cron Jobs:</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto">
{`// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-reservations",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/reservations/abandoned/notify",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}`}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Using Traditional Cron:</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto">
{`# Add to crontab
*/15 * * * * curl -X POST https://yourdomain.com/api/cron/cleanup-reservations -H "Authorization: Bearer $CRON_SECRET"
0 10 * * * curl -X POST https://yourdomain.com/api/reservations/abandoned/notify -H "Authorization: Bearer $CRON_SECRET"
0 9 * * * curl -X POST https://yourdomain.com/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"`}
            </pre>
          </div>

          <div className="text-sm text-gray-700 bg-white p-3 rounded border">
            <strong>Note:</strong> Make sure to set <code className="bg-gray-100 px-2 py-1 rounded">CRON_SECRET</code> in your environment variables for security.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

