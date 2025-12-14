"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DeleteCarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [carName, setCarName] = useState("")

  useEffect(() => {
    fetchCar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCar = async () => {
    try {
      const response = await fetch(`/api/cars/${id}`)
      const data = await response.json()
      setCarName(data.car.name)
    } catch (error) {
      console.error("Error fetching car:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${carName}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)

    try {
      const response = await fetch(`/api/admin/cars/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        router.push("/admin/cars")
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to delete car")
      }
    } catch (error) {
      console.error("Error deleting car:", error)
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
      <h2 className="text-3xl font-bold mb-6">Delete Car</h2>

      <Card>
        <CardHeader>
          <CardTitle>Confirm Deletion</CardTitle>
          <CardDescription>
            Are you sure you want to delete this car?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            You are about to delete: <strong>{carName}</strong>
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
              {deleting ? "Deleting..." : "Delete Car"}
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

