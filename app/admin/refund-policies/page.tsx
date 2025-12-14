"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface RefundPolicy {
  id: string
  daysBeforeService: number
  nonRefundablePercent: number
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export default function RefundPoliciesPage() {
  const [policies, setPolicies] = useState<RefundPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<RefundPolicy | null>(null)
  const [formData, setFormData] = useState({
    daysBeforeService: "",
    nonRefundablePercent: "",
    description: "",
    isActive: true,
  })

  useEffect(() => {
    fetchPolicies()
  }, [])

  const fetchPolicies = async () => {
    try {
      const response = await fetch("/api/admin/refund-policies")
      const data = await response.json()
      setPolicies(data.policies || [])
    } catch (error) {
      console.error("Error fetching policies:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const url = editingPolicy
      ? `/api/admin/refund-policies/${editingPolicy.id}`
      : "/api/admin/refund-policies"
    const method = editingPolicy ? "PUT" : "POST"

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daysBeforeService: parseInt(formData.daysBeforeService),
          nonRefundablePercent: parseFloat(formData.nonRefundablePercent),
          description: formData.description || null,
          isActive: formData.isActive,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to save policy")
        return
      }

      setIsDialogOpen(false)
      setEditingPolicy(null)
      setFormData({
        daysBeforeService: "",
        nonRefundablePercent: "",
        description: "",
        isActive: true,
      })
      fetchPolicies()
    } catch (error) {
      console.error("Error saving policy:", error)
      alert("Failed to save policy")
    }
  }

  const handleEdit = (policy: RefundPolicy) => {
    setEditingPolicy(policy)
    setFormData({
      daysBeforeService: policy.daysBeforeService.toString(),
      nonRefundablePercent: policy.nonRefundablePercent.toString(),
      description: policy.description || "",
      isActive: policy.isActive,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this policy?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/refund-policies/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        alert("Failed to delete policy")
        return
      }

      fetchPolicies()
    } catch (error) {
      console.error("Error deleting policy:", error)
      alert("Failed to delete policy")
    }
  }

  const handleNewPolicy = () => {
    setEditingPolicy(null)
    setFormData({
      daysBeforeService: "",
      nonRefundablePercent: "",
      description: "",
      isActive: true,
    })
    setIsDialogOpen(true)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  // Sort policies by daysBeforeService (descending)
  const sortedPolicies = [...policies].sort(
    (a, b) => b.daysBeforeService - a.daysBeforeService
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Refund Policies</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewPolicy}>Add Policy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPolicy ? "Edit Policy" : "New Refund Policy"}
              </DialogTitle>
              <DialogDescription>
                Configure non-refundable amounts based on days before service date.
                Policies are applied based on the closest match (daysBeforeService &lt;= actual days).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="daysBeforeService">Days Before Service</Label>
                  <Input
                    id="daysBeforeService"
                    type="number"
                    min="0"
                    value={formData.daysBeforeService}
                    onChange={(e) =>
                      setFormData({ ...formData, daysBeforeService: e.target.value })
                    }
                    required
                    placeholder="e.g., 30"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Applies to cancellations this many days or more before service date
                  </p>
                </div>
                <div>
                  <Label htmlFor="nonRefundablePercent">
                    Non-Refundable Percentage
                  </Label>
                  <Input
                    id="nonRefundablePercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.nonRefundablePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nonRefundablePercent: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g., 10.5"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Percentage of booking total that is non-refundable (0-100)
                  </p>
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="e.g., 30+ days: 10% non-refundable"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Policy</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {sortedPolicies.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">No refund policies configured</p>
              <p className="text-sm text-gray-400 mt-2">
                Add a policy to set non-refundable amounts based on cancellation timing
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedPolicies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      {policy.daysBeforeService}+ Days Before Service
                    </CardTitle>
                    <CardDescription className="text-green-600 font-medium">
                      {100 - policy.nonRefundablePercent}% Refund ({policy.nonRefundablePercent}% non-refundable)
                    </CardDescription>
                    {policy.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {policy.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(policy)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(policy.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500">
                  Status:{" "}
                  <span
                    className={
                      policy.isActive ? "text-green-600" : "text-gray-400"
                    }
                  >
                    {policy.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How Refund Policies Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            • Policies are matched based on the number of days before the service date
          </p>
          <p>
            • The system finds the policy with the highest daysBeforeService that is
            less than or equal to the actual days before service
          </p>
          <p>
            • Example: If a customer cancels 25 days before service, and you have
            policies for 30 days (10%) and 14 days (50%), the 14-day policy applies
          </p>
          <p>
            • If no policy matches, the booking is fully refundable (100% refund)
          </p>
          <p>
            • If cancellation happens after the service date, no refund is available
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

