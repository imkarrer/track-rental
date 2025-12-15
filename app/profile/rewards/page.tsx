"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Reward = {
  id: string
  amount: number
  status: string
  createdAt: string
  bookingId?: string | null
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/rewards")
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load rewards")
        setRewards(json.rewards || [])
      } catch (err: any) {
        setError(err?.message || "Failed to load rewards")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <h1 className="text-3xl font-bold">Rewards</h1>
      <p className="text-sm text-gray-600">
        Use available rewards during checkout to reduce your total.
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rewards.length === 0 ? (
        <p className="text-gray-500 text-sm">No rewards yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rewards.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>${Number(r.amount).toFixed(2)}</span>
                  <Badge
                    variant={
                      r.status === "AWARDED"
                        ? "default"
                        : r.status === "REDEEMED"
                        ? "secondary"
                        : r.status === "RESERVED"
                        ? "outline"
                        : "destructive"
                    }
                  >
                    {r.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <div>Created: {new Date(r.createdAt).toLocaleString()}</div>
                {r.bookingId && <div>Applied to booking: {r.bookingId.slice(0, 8)}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


