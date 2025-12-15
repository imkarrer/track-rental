"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2 } from "lucide-react"
import { formatDateUTC } from "@/lib/date/format"

interface Charger {
  id: string
  name: string
  batteryType: "NIMH" | "LIION" | "ALKALINE" | "LITHIUM_DISPOSABLE"
  capacity: number
  purchaseDate: string
  purchaseCost: number
  expectedLifespanYears: number | null
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export default function ChargersPage() {
  const [chargers, setChargers] = useState<Charger[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    batteryType: "NIMH" as "NIMH" | "LIION" | "ALKALINE" | "LITHIUM_DISPOSABLE",
    capacity: "",
    purchaseDate: "",
    purchaseCost: "",
    expectedLifespanYears: "",
    isActive: true,
    notes: "",
  })

  useEffect(() => {
    fetchChargers()
  }, [])

  const fetchChargers = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/chargers")
      if (response.ok) {
        const data = await response.json()
        setChargers(data.chargers || [])
      }
    } catch (error) {
      console.error("Error fetching chargers:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        capacity: parseInt(formData.capacity),
        purchaseCost: parseFloat(formData.purchaseCost),
        expectedLifespanYears: formData.expectedLifespanYears ? parseInt(formData.expectedLifespanYears) : null,
        notes: formData.notes || null,
      }

      const url = editingId
        ? `/api/admin/chargers/${editingId}`
        : "/api/admin/chargers"
      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        await fetchChargers()
        resetForm()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to save charger")
      }
    } catch (error) {
      console.error("Error saving charger:", error)
      alert("Failed to save charger")
    }
  }

  const handleEdit = (charger: Charger) => {
    setEditingId(charger.id)
    setFormData({
      name: charger.name,
      batteryType: charger.batteryType,
      capacity: charger.capacity.toString(),
      purchaseDate: charger.purchaseDate.split("T")[0],
      purchaseCost: charger.purchaseCost.toString(),
      expectedLifespanYears: charger.expectedLifespanYears?.toString() || "",
      isActive: charger.isActive,
      notes: charger.notes || "",
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this charger?")) return

    try {
      const response = await fetch(`/api/admin/chargers/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchChargers()
      } else {
        alert("Failed to delete charger")
      }
    } catch (error) {
      console.error("Error deleting charger:", error)
      alert("Failed to delete charger")
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      batteryType: "NIMH",
      capacity: "",
      purchaseDate: "",
      purchaseCost: "",
      expectedLifespanYears: "",
      isActive: true,
      notes: "",
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading chargers...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Charger Management</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "Add Charger"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Charger" : "New Charger"}</CardTitle>
            <CardDescription>
              Track chargers with purchase costs and expected lifespan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Charger Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., 32-Bay NiMH Charger"
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
                    <option value="NIMH">NiMH</option>
                    <option value="LIION">Li-ion</option>
                    <option value="ALKALINE">Alkaline (not applicable)</option>
                    <option value="LITHIUM_DISPOSABLE">Lithium Disposable (not applicable)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Only NiMH and Li-ion batteries use chargers
                  </p>
                </div>
                <div>
                  <Label htmlFor="capacity">Capacity (batteries) *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    required
                    min="1"
                    placeholder="e.g., 32"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of batteries this charger can charge at once
                  </p>
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
                <div>
                  <Label htmlFor="expectedLifespanYears">Expected Lifespan (years)</Label>
                  <Input
                    id="expectedLifespanYears"
                    type="number"
                    value={formData.expectedLifespanYears}
                    onChange={(e) => setFormData({ ...formData, expectedLifespanYears: e.target.value })}
                    min="1"
                    placeholder="e.g., 5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used to calculate amortization per rental
                  </p>
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
                <Button type="submit">{editingId ? "Update" : "Create"} Charger</Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {chargers.map((charger) => (
          <Card key={charger.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{charger.name}</CardTitle>
                  <CardDescription>
                    {charger.batteryType} • {charger.capacity} batteries
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(charger)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(charger.id)}
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
                  <p>{formatDateUTC(charger.purchaseDate)}</p>
                </div>
                <div>
                  <span className="font-medium">Purchase Cost:</span>
                  <p>${Number(charger.purchaseCost).toFixed(2)}</p>
                </div>
                {charger.expectedLifespanYears && (
                  <div>
                    <span className="font-medium">Lifespan:</span>
                    <p>{charger.expectedLifespanYears} years</p>
                  </div>
                )}
                <div>
                  <span className="font-medium">Status:</span>
                  <p className={charger.isActive ? "text-green-600" : "text-gray-500"}>
                    {charger.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              {charger.notes && (
                <div className="mt-4">
                  <span className="font-medium text-sm">Notes:</span>
                  <p className="text-sm text-gray-600">{charger.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {chargers.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>No chargers yet. Click &quot;Add Charger&quot; to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

