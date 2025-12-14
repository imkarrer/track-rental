"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Redemption = {
  id: string
  referredUserId: string
  user?: {
    email: string | null
    firstName: string | null
    lastName: string | null
    createdAt: string
  } | null
  createdAt: string
}

type PromoCode = {
  id: string
  code: string
  name: string | null
  description: string | null
  maxUses: number
  uses: number
  isActive: boolean
  createdAt: string
  redemptions: Redemption[]
}

export function AdminPromoCodesManager() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    maxUses: "100",
    generateName: false,
    generateCode: false,
  })

  // Edit form state
  const [editData, setEditData] = useState<{
    name: string
    description: string
    maxUses: string
  }>({
    name: "",
    description: "",
    maxUses: "100",
  })

  useEffect(() => {
    fetchPromoCodes()
  }, [])

  const fetchPromoCodes = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/promo-codes")
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to load promo codes")
      }
      setPromoCodes(json.promoCodes || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load promo codes")
    } finally {
      setLoading(false)
    }
  }

  const createPromoCode = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name || undefined,
          code: formData.code || undefined,
          description: formData.description || undefined,
          maxUses: Number(formData.maxUses) || 100,
          generateName: formData.generateName,
          generateCode: formData.generateCode,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to create promo code")
      }
      // Reset form
      setFormData({
        name: "",
        code: "",
        description: "",
        maxUses: "100",
        generateName: false,
        generateCode: false,
      })
      await fetchPromoCodes()
    } catch (err: any) {
      setError(err?.message || "Failed to create promo code")
    } finally {
      setCreating(false)
    }
  }

  const updatePromoCode = async (id: string, isActive?: boolean) => {
    try {
      const updatePayload = isActive !== undefined 
        ? { isActive }
        : {
            name: editData.name,
            description: editData.description,
            maxUses: Number(editData.maxUses),
          }

      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to update promo code")
      }
      setEditingId(null)
      await fetchPromoCodes()
    } catch (err: any) {
      setError(err?.message || "Failed to update promo code")
    }
  }

  const deletePromoCode = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promo code? This cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to delete promo code")
      }
      await fetchPromoCodes()
    } catch (err: any) {
      setError(err?.message || "Failed to delete promo code")
    }
  }

  const startEdit = (code: PromoCode) => {
    setEditingId(code.id)
    setEditData({
      name: code.name || "",
      description: code.description || "",
      maxUses: code.maxUses.toString(),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🎟️</span>
          Admin Promotional Codes
        </CardTitle>
        <CardDescription>
          Create and manage promotional codes for advertising campaigns, special offers, and marketing initiatives.
          These are different from user referral codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create Form */}
        <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
          <h3 className="font-semibold text-lg">Create New Promo Code</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (Optional)</Label>
              <Input
                id="name"
                placeholder="e.g., Summer Sale, Launch Special"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={formData.generateName}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.generateName}
                  onChange={(e) => setFormData({ ...formData, generateName: e.target.checked })}
                />
                Generate catchy name automatically
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Code (Optional)</Label>
              <Input
                id="code"
                placeholder="e.g., SUMMER2025"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                disabled={formData.generateCode}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.generateCode}
                  onChange={(e) => setFormData({ ...formData, generateCode: e.target.checked })}
                />
                Generate code automatically
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="What is this promo code for? Internal notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxUses">Max Uses</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                max="10000"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                className="w-32"
              />
            </div>
            <div className="flex-1" />
            <Button onClick={createPromoCode} disabled={creating} size="lg">
              {creating ? "Creating..." : "✨ Create Promo Code"}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </p>
          )}
        </div>

        {/* Promo Codes List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Active Promotional Codes</h3>
            <Button variant="outline" size="sm" onClick={fetchPromoCodes}>
              🔄 Refresh
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : promoCodes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No promotional codes yet. Create one above!
            </p>
          ) : (
            <div className="space-y-3">
              {promoCodes.map((code) => (
                <div key={code.id} className="border rounded-lg p-4 space-y-3">
                  {editingId === code.id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label>Max Uses</Label>
                        <Input
                          type="number"
                          value={editData.maxUses}
                          onChange={(e) => setEditData({ ...editData, maxUses: e.target.value })}
                          className="w-32"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => updatePromoCode(code.id)} size="sm">
                          💾 Save
                        </Button>
                        <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="font-mono text-2xl font-bold tracking-wider bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {code.code}
                            </div>
                            {code.name && (
                              <div className="text-lg font-semibold text-gray-700">
                                &quot;{code.name}&quot;
                              </div>
                            )}
                            <Badge variant={code.isActive ? "default" : "secondary"}>
                              {code.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline">
                              {code.uses}/{code.maxUses} used
                            </Badge>
                          </div>
                          {code.description && (
                            <p className="text-sm text-gray-600 mt-1">{code.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Created {new Date(code.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => startEdit(code)} variant="outline" size="sm">
                            ✏️ Edit
                          </Button>
                          <Button
                            onClick={() => updatePromoCode(code.id, !code.isActive)}
                            variant="outline"
                            size="sm"
                          >
                            {code.isActive ? "🚫 Deactivate" : "✅ Activate"}
                          </Button>
                          <Button
                            onClick={() => deletePromoCode(code.id)}
                            variant="destructive"
                            size="sm"
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>

                      {/* Redemptions */}
                      {code.redemptions.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-semibold mb-2">Redemptions ({code.redemptions.length})</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {code.redemptions.map((r) => (
                              <div key={r.id} className="text-xs text-gray-700 flex justify-between">
                                <div>
                                  <span className="font-semibold">
                                    {r.user?.email || r.referredUserId}
                                  </span>
                                  {r.user && (
                                    <span className="text-gray-500 ml-2">
                                      {(r.user.firstName || "") + " " + (r.user.lastName || "")}
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-500">
                                  {new Date(r.createdAt).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

