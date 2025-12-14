"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface Holiday {
  id: string
  name: string
  date: string
  isRecurring: boolean
  year: number | null
  isActive: boolean
  notes: string | null
}

export default function HolidaysPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    isRecurring: false,
    year: "",
    isActive: true,
    notes: "",
  })

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    setLoading(true)
    try {
      const currentYear = new Date().getFullYear()
      const response = await fetch(`/api/admin/holidays?year=${currentYear}`)
      if (response.ok) {
        const data = await response.json()
        setHolidays(data.holidays || [])
      }
    } catch (error) {
      console.error("Error fetching holidays:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm("This will delete ALL holidays. Are you sure you want to continue?")) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/admin/holidays", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteAll" }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully deleted ${data.count} holidays!`)
        fetchHolidays()
      } else {
        const error = await response.json()
        alert(`Failed to delete holidays: ${error.error}`)
      }
    } catch (error) {
      console.error("Error deleting holidays:", error)
      alert("An error occurred while deleting holidays.")
    } finally {
      setSaving(false)
    }
  }

  const handleInitialize = async () => {
    if (!confirm("This will create standard US bank holidays for the current and next year. Continue?")) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/admin/holidays", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize" }),
      })

      if (response.ok) {
        alert("Holidays initialized successfully!")
        fetchHolidays()
      } else {
        const error = await response.json()
        alert(`Failed to initialize holidays: ${error.error}`)
      }
    } catch (error) {
      console.error("Error initializing holidays:", error)
      alert("An error occurred while initializing holidays.")
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        name: formData.name,
        date: formData.date,
        isRecurring: formData.isRecurring,
        year: formData.year ? parseInt(formData.year) : null,
        isActive: formData.isActive,
        notes: formData.notes || null,
      }

      let response
      if (editingId) {
        response = await fetch(`/api/admin/holidays/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch("/api/admin/holidays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (response.ok) {
        alert(editingId ? "Holiday updated successfully!" : "Holiday created successfully!")
        setShowAddForm(false)
        setEditingId(null)
        setFormData({
          name: "",
          date: "",
          isRecurring: false,
          year: "",
          isActive: true,
          notes: "",
        })
        fetchHolidays()
      } else {
        const error = await response.json()
        alert(`Failed to save holiday: ${error.error}`)
      }
    } catch (error) {
      console.error("Error saving holiday:", error)
      alert("An error occurred while saving the holiday.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (holiday: Holiday) => {
    setEditingId(holiday.id)
    // Prisma returns DATE fields as UTC midnight, use UTC components for form
    const date = new Date(holiday.date)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    setFormData({
      name: holiday.name,
      date: dateStr,
      isRecurring: holiday.isRecurring,
      year: holiday.year?.toString() || "",
      isActive: holiday.isActive,
      notes: holiday.notes || "",
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/holidays/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        alert("Holiday deleted successfully!")
        fetchHolidays()
      } else {
        const error = await response.json()
        alert(`Failed to delete holiday: ${error.error}`)
      }
    } catch (error) {
      console.error("Error deleting holiday:", error)
      alert("An error occurred while deleting the holiday.")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Loading holidays...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Holiday Management</h2>
        <div className="flex gap-2">
          <Button onClick={handleDeleteAll} variant="destructive" disabled={saving}>
            {saving ? "Deleting..." : "Delete All Holidays"}
          </Button>
          <Button onClick={handleInitialize} variant="outline" disabled={saving}>
            {saving ? "Initializing..." : "Initialize Standard Holidays"}
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? "Cancel" : "Add Holiday"}
          </Button>
        </div>
      </div>

      <p className="text-gray-600 mb-6">
        Holidays override day-of-week pricing multipliers. Standard US bank holidays can be initialized automatically.
      </p>

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Holiday" : "Add New Holiday"}</CardTitle>
            <CardDescription>
              {editingId ? "Update holiday details" : "Create a custom holiday with special pricing"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Holiday Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>


              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isRecurring: checked as boolean })
                  }
                />
                <Label htmlFor="isRecurring">Recurring (applies every year)</Label>
              </div>

              {!formData.isRecurring && (
                <div>
                  <Label htmlFor="year">Year (optional, for one-time holidays)</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g., 2024"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked as boolean })
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional information about this holiday"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update Holiday" : "Create Holiday"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingId(null)
                    setFormData({
                      name: "",
                      date: "",
                      isRecurring: false,
                      year: "",
                      isActive: true,
                      notes: "",
                    })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Holidays</CardTitle>
          <CardDescription>
            {holidays.length} holiday{holidays.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No holidays configured. Click &quot;Initialize Standard Holidays&quot; to add US bank holidays.
            </p>
          ) : (
            <div className="space-y-4">
              {holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{holiday.name}</h3>
                      {!holiday.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Inactive
                        </span>
                      )}
                      {holiday.isRecurring && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          Recurring
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {(() => {
                        // Prisma returns DATE fields as UTC midnight, so we need to use UTC components
                        const date = new Date(holiday.date)
                        const year = date.getUTCFullYear()
                        const month = date.getUTCMonth()
                        const day = date.getUTCDate()
                        // Create a local date from UTC components to display correctly
                        const displayDate = new Date(year, month, day)
                        return displayDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      })()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Uses global holiday multiplier
                      {holiday.notes && ` • ${holiday.notes}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(holiday)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(holiday.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

