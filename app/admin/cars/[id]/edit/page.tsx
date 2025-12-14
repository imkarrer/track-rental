"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/ui/file-upload"
import { CarBreakEvenAnalysis } from "@/components/admin/car-break-even-analysis"

export default function EditCarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "ROAD" as "ROAD" | "OFFROAD",
    type: "",
    unitCost: "",
    basePricePerDay: "",
    stockQuantity: "0",
    imageUrls: [] as string[],
    isActive: true,
  })

  useEffect(() => {
    fetchCar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCar = async () => {
    try {
      const response = await fetch(`/api/cars/${id}`)
      const data = await response.json()
      const car = data.car

      setFormData({
        name: car.name,
        description: car.description || "",
        category: car.category || "ROAD",
        type: car.type,
        unitCost: car.unitCost ? car.unitCost.toString() : "",
        basePricePerDay: car.basePricePerDay.toString(),
        stockQuantity: car.stockQuantity.toString(),
        imageUrls: car.imageUrls || [],
        isActive: car.isActive,
      })
    } catch (error) {
      console.error("Error fetching car:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(`/api/admin/cars/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          unitCost: formData.unitCost ? parseFloat(formData.unitCost) : null,
          basePricePerDay: parseFloat(formData.basePricePerDay),
          stockQuantity: parseInt(formData.stockQuantity),
          imageUrls: formData.imageUrls,
        }),
      })

      if (response.ok) {
        router.push("/admin/cars")
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update car")
      }
    } catch (error) {
      console.error("Error updating car:", error)
      alert("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Edit Car</h2>

      <Card>
        <CardHeader>
          <CardTitle>Car Information</CardTitle>
          <CardDescription>Update car details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as "ROAD" | "OFFROAD",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="ROAD">Road</option>
                <option value="OFFROAD">Offroad</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <Input
                name="type"
                value={formData.type}
                onChange={handleChange}
                placeholder="e.g., 1/10 scale, 1/8 scale"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Unit Cost ($)
                </label>
                <Input
                  name="unitCost"
                  type="number"
                  step="0.01"
                  value={formData.unitCost}
                  onChange={handleChange}
                  placeholder="Purchase cost for break-even analysis"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Purchase cost of the car for break-even analysis
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Base Price per Day ($) *
                </label>
                <Input
                  name="basePricePerDay"
                  type="number"
                  step="0.01"
                  value={formData.basePricePerDay}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Price charged for additional cars beyond the 2 free ones included with track rental
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Stock Quantity *
              </label>
              <Input
                name="stockQuantity"
                type="number"
                value={formData.stockQuantity}
                onChange={handleChange}
                required
              />
            </div>

            {/* Break-Even Analysis */}
            {formData.unitCost && formData.basePricePerDay && (
              <CarBreakEvenAnalysis
                unitCost={formData.unitCost}
                basePricePerDay={formData.basePricePerDay}
              />
            )}

            <FileUpload
              folder="cars"
              multiple={true}
              existingUrls={formData.imageUrls}
              onUploadComplete={(urls) => {
                setFormData({ ...formData, imageUrls: urls })
              }}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Active</label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

