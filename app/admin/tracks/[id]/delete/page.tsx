"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DeleteTrackPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [trackName, setTrackName] = useState("")

  useEffect(() => {
    fetchTrack()
  }, [])

  const fetchTrack = async () => {
    try {
      const response = await fetch(`/api/tracks/${params.id}`)
      const data = await response.json()
      setTrackName(data.track.name)
    } catch (error) {
      console.error("Error fetching track:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${trackName}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)

    try {
      const response = await fetch(`/api/admin/tracks/${params.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        router.push("/admin/tracks")
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to delete track")
      }
    } catch (error) {
      console.error("Error deleting track:", error)
      alert("An error occurred")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Delete Track</h2>

      <Card>
        <CardHeader>
          <CardTitle>Confirm Deletion</CardTitle>
          <CardDescription>
            Are you sure you want to delete this track?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            You are about to delete: <strong>{trackName}</strong>
          </p>
          <p className="text-red-600 mb-6">
            This action cannot be undone. All associated bookings will be
            affected.
          </p>

          <div className="flex gap-4">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Track"}
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

