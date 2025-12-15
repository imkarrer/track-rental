"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/ui/file-upload"
import { BreakEvenAnalysis } from "@/components/admin/break-even-analysis"
import { TrackCarSelection } from "@/components/admin/track-car-selection"

export default function EditTrackPage({
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
    length: "",
    width: "",
    minSpaceLength: "",
    minSpaceWidth: "",
    unitCost: "",
    includedCarIds: [] as string[],
    basePrice: "",
    setupTimeMinutes: "",
    imageUrls: [] as string[],
    isActive: true,
    testOnly: false,
  })

  useEffect(() => {
    fetchTrack()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTrack = async () => {
    try {
      const response = await fetch(`/api/tracks/${id}`)
      const data = await response.json()
      const track = data.track

      setFormData({
        name: track.name,
        description: track.description || "",
        category: track.category || "ROAD",
        length: track.length.toString(),
        width: track.width.toString(),
        minSpaceLength: track.minSpaceLength.toString(),
        minSpaceWidth: track.minSpaceWidth.toString(),
        unitCost: track.unitCost ? track.unitCost.toString() : "",
        includedCarIds: track.includedCarIds || [],
        basePrice: track.basePrice.toString(),
        setupTimeMinutes: track.setupTimeMinutes.toString(),
        imageUrls: track.imageUrls || [],
        isActive: track.isActive,
        testOnly: track.testOnly || false,
      })
    } catch (error) {
      console.error("Error fetching track:", error)
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
      const response = await fetch(`/api/admin/tracks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          category: formData.category, // Explicitly include category
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          minSpaceLength: parseFloat(formData.minSpaceLength),
          minSpaceWidth: parseFloat(formData.minSpaceWidth),
          unitCost: formData.unitCost ? parseFloat(formData.unitCost) : null,
          basePrice: parseFloat(formData.basePrice),
          setupTimeMinutes: parseInt(formData.setupTimeMinutes),
          imageUrls: formData.imageUrls,
        }),
      })

      if (response.ok) {
        router.push("/admin/tracks")
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update track")
      }
    } catch (error) {
      console.error("Error updating track:", error)
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
      <h2 className="text-3xl font-bold mb-6">Edit Track</h2>

      <Card>
        <CardHeader>
          <CardTitle>Track Information</CardTitle>
          <CardDescription>Update track details</CardDescription>
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
                    includedCarIds: [], // Reset car selection when category changes
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
              <TrackCarSelection
                category={formData.category}
                selectedCarIds={formData.includedCarIds}
                onChange={(carIds) =>
                  setFormData({ ...formData, includedCarIds: carIds })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Length (ft) *
                </label>
                <Input
                  name="length"
                  type="number"
                  step="0.1"
                  value={formData.length}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Width (ft) *
                </label>
                <Input
                  name="width"
                  type="number"
                  step="0.1"
                  value={formData.width}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Min Space Length (ft) *
                </label>
                <Input
                  name="minSpaceLength"
                  type="number"
                  step="0.1"
                  value={formData.minSpaceLength}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Min Space Width (ft) *
                </label>
                <Input
                  name="minSpaceWidth"
                  type="number"
                  step="0.1"
                  value={formData.minSpaceWidth}
                  onChange={handleChange}
                  required
                />
              </div>
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
                  placeholder="Track purchase cost"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Purchase cost of the track for break-even analysis
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Base Price ($) *
                </label>
                <Input
                  name="basePrice"
                  type="number"
                  step="0.01"
                  value={formData.basePrice}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Setup Time (minutes) *
                </label>
                <Input
                  name="setupTimeMinutes"
                  type="number"
                  value={formData.setupTimeMinutes}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Break-Even Analysis */}
            {formData.unitCost && formData.basePrice && formData.setupTimeMinutes && formData.includedCarIds.length === 2 && (
              <BreakEvenAnalysis
                unitCost={formData.unitCost}
                basePrice={formData.basePrice}
                setupTimeMinutes={formData.setupTimeMinutes}
                includedCarIds={formData.includedCarIds}
                category={formData.category}
              />
            )}

            <FileUpload
              folder="tracks"
              multiple={true}
              existingUrls={formData.imageUrls}
              enableCrop={true}
              aspectRatio={undefined}
              onUploadComplete={(urls) => {
                setFormData({ ...formData, imageUrls: urls })
              }}
            />

            <div className="flex items-center gap-4">
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
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="testOnly"
                  checked={formData.testOnly}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium">Test Only</label>
                <span className="text-xs text-gray-500">(Hidden from public, for e2e testing with real payments)</span>
              </div>
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

