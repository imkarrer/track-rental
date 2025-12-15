"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Plus, Edit, Trash2 } from "lucide-react"
import { formatDateUTC } from "@/lib/date/format"

interface BatteryBatch {
  id: string
  name: string
  batteryType: "NIMH" | "LIION" | "ALKALINE" | "LITHIUM_DISPOSABLE"
  usage: "CAR" | "TRANSMITTER"
  quantity: number
  purchaseDate: string
  purchaseCost: number
  expectedCycles: number | null
  expectedRuntimeRoad: number | null
  expectedRuntimeOffroad: number | null
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export default function BatteriesPage() {
  const [batteries, setBatteries] = useState<BatteryBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    batteryType: "NIMH" as "NIMH" | "LIION" | "ALKALINE" | "LITHIUM_DISPOSABLE",
    usage: "CAR" as "CAR" | "TRANSMITTER",
    quantity: "",
    purchaseDate: "",
    purchaseCost: "",
    expectedCycles: "",
    expectedRuntimeRoad: "",
    expectedRuntimeOffroad: "",
    isActive: true,
    notes: "",
  })

  useEffect(() => {
    fetchBatteries()
  }, [])

  const fetchBatteries = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/batteries")
      if (response.ok) {
        const data = await response.json()
        setBatteries(data.batteries)
      }
    } catch (error) {
      console.error("Error fetching batteries:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        quantity: parseInt(formData.quantity),
        purchaseCost: parseFloat(formData.purchaseCost),
        expectedCycles: formData.expectedCycles ? parseInt(formData.expectedCycles) : null,
        expectedRuntimeRoad: formData.expectedRuntimeRoad ? parseFloat(formData.expectedRuntimeRoad) : null,
        expectedRuntimeOffroad: formData.expectedRuntimeOffroad ? parseFloat(formData.expectedRuntimeOffroad) : null,
        notes: formData.notes || null,
      }

      const url = editingId
        ? `/api/admin/batteries/${editingId}`
        : "/api/admin/batteries"
      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        await fetchBatteries()
        resetForm()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to save battery batch")
      }
    } catch (error) {
      console.error("Error saving battery batch:", error)
      alert("Failed to save battery batch")
    }
  }

  const handleEdit = (battery: BatteryBatch) => {
    setEditingId(battery.id)
    setFormData({
      name: battery.name,
      batteryType: battery.batteryType,
      usage: battery.usage,
      quantity: battery.quantity.toString(),
      purchaseDate: battery.purchaseDate.split("T")[0],
      purchaseCost: battery.purchaseCost.toString(),
      expectedCycles: battery.expectedCycles?.toString() || "",
      expectedRuntimeRoad: battery.expectedRuntimeRoad?.toString() || "",
      expectedRuntimeOffroad: battery.expectedRuntimeOffroad?.toString() || "",
      isActive: battery.isActive,
      notes: battery.notes || "",
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this battery batch?")) return

    try {
      const response = await fetch(`/api/admin/batteries/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchBatteries()
      } else {
        alert("Failed to delete battery batch")
      }
    } catch (error) {
      console.error("Error deleting battery batch:", error)
      alert("Failed to delete battery batch")
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      batteryType: "NIMH",
      usage: "CAR",
      quantity: "",
      purchaseDate: "",
      purchaseCost: "",
      expectedCycles: "",
      expectedRuntimeRoad: "",
      expectedRuntimeOffroad: "",
      isActive: true,
      notes: "",
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading batteries...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Battery Management</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "Add Battery Batch"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Battery Batch" : "New Battery Batch"}</CardTitle>
            <CardDescription>
              Track battery batches with purchase costs, expected cycles, and runtime
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Batch Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., NiMH Transmitter Batch 1"
                  />
                </div>
                <div>
                  <Label htmlFor="batteryType">Battery Type *</Label>
                  <select
                    id="batteryType"
                    value={formData.batteryType}
                    onChange={(e) => setFormData({ ...formData, batteryType: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="NIMH">NiMH (Rechargeable)</option>
                    <option value="LIION">Li-ion (Rechargeable)</option>
                    <option value="ALKALINE">Alkaline (Disposable)</option>
                    <option value="LITHIUM_DISPOSABLE">Lithium Disposable</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="usage">Usage *</Label>
                  <select
                    id="usage"
                    value={formData.usage}
                    onChange={(e) => setFormData({ ...formData, usage: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="CAR">Car</option>
                    <option value="TRANSMITTER">Transmitter</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                    min="1"
                  />
                </div>
                <div>
                  <Label htmlFor="purchaseDate">Purchase Date *</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="purchaseCost">Purchase Cost ($) *</Label>
                  <Input
                    id="purchaseCost"
                    type="number"
                    step="0.01"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                    required
                    min="0"
                  />
                </div>
                {(formData.batteryType === "NIMH" || formData.batteryType === "LIION") && (
                  <>
                    <div>
                      <Label htmlFor="expectedCycles">Expected Cycles</Label>
                      <Input
                        id="expectedCycles"
                        type="number"
                        value={formData.expectedCycles}
                        onChange={(e) => setFormData({ ...formData, expectedCycles: e.target.value })}
                        min="1"
                        placeholder="e.g., 500"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="expectedRuntimeRoad">Expected Runtime - Road (minutes)</Label>
                  <Input
                    id="expectedRuntimeRoad"
                    type="number"
                    step="0.1"
                    value={formData.expectedRuntimeRoad}
                    onChange={(e) => setFormData({ ...formData, expectedRuntimeRoad: e.target.value })}
                    min="0"
                    placeholder="e.g., 30"
                  />
                </div>
                <div>
                  <Label htmlFor="expectedRuntimeOffroad">Expected Runtime - Offroad (minutes)</Label>
                  <Input
                    id="expectedRuntimeOffroad"
                    type="number"
                    step="0.1"
                    value={formData.expectedRuntimeOffroad}
                    onChange={(e) => setFormData({ ...formData, expectedRuntimeOffroad: e.target.value })}
                    min="0"
                    placeholder="e.g., 25"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex gap-4">
                <Button type="submit">{editingId ? "Update" : "Create"} Battery Batch</Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {batteries.map((battery) => (
          <Card key={battery.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{battery.name}</CardTitle>
                  <CardDescription>
                    {battery.batteryType} • {battery.usage} • {battery.quantity} batteries
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(battery)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(battery.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Purchase Date:</span>
                  <p>{formatDateUTC(battery.purchaseDate)}</p>
                </div>
                <div>
                  <span className="font-medium">Purchase Cost:</span>
                  <p>${Number(battery.purchaseCost).toFixed(2)}</p>
                </div>
                {battery.expectedCycles && (
                  <div>
                    <span className="font-medium">Expected Cycles:</span>
                    <p>{battery.expectedCycles}</p>
                  </div>
                )}
                {battery.expectedRuntimeRoad && (
                  <div>
                    <span className="font-medium">Runtime (Road):</span>
                    <p>{battery.expectedRuntimeRoad} min</p>
                  </div>
                )}
                {battery.expectedRuntimeOffroad && (
                  <div>
                    <span className="font-medium">Runtime (Offroad):</span>
                    <p>{battery.expectedRuntimeOffroad} min</p>
                  </div>
                )}
                <div>
                  <span className="font-medium">Status:</span>
                  <p className={battery.isActive ? "text-green-600" : "text-gray-500"}>
                    {battery.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              {battery.notes && (
                <div className="mt-4">
                  <span className="font-medium text-sm">Notes:</span>
                  <p className="text-sm text-gray-600">{battery.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {batteries.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>No battery batches yet. Click &quot;Add Battery Batch&quot; to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

