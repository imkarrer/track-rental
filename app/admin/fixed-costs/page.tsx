"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function FixedCostsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    expectedRentals: "60",
    monthlyRentalsTarget: "4",
    laborRatePerHour: "20",
    breakdownTimeHours: "1",
    averageDistanceMiles: "20",
    fuelCostPerMile: "0.50",
    apiEmailCosts: "0.11",
    smsCostPerMessage: "0.01",
    stripeFeeRate: "0.029",
    stripeFixedFee: "0.30",
    serverHostingMonthly: "25",
    databaseMonthly: "12",
    emailServiceMonthly: "10",
    domainMonthly: "1",
    insuranceMonthly: "41.67",
    holidayMultiplier: "1.5",
  })
  const [totalMonthlyRecurring, setTotalMonthlyRecurring] = useState(0)
  const [batteryCostsPerRental, setBatteryCostsPerRental] = useState(0)
  const [chargerCostsPerRental, setChargerCostsPerRental] = useState(0)
  const [totalBatteryChargerCosts, setTotalBatteryChargerCosts] = useState(0)

  useEffect(() => {
    fetchConfig()
  }, [])

  useEffect(() => {
    // Calculate total monthly recurring costs
    const total =
      parseFloat(formData.serverHostingMonthly || "0") +
      parseFloat(formData.databaseMonthly || "0") +
      parseFloat(formData.emailServiceMonthly || "0") +
      parseFloat(formData.domainMonthly || "0") +
      parseFloat(formData.insuranceMonthly || "0")
    setTotalMonthlyRecurring(total)
  }, [
    formData.serverHostingMonthly,
    formData.databaseMonthly,
    formData.emailServiceMonthly,
    formData.domainMonthly,
    formData.insuranceMonthly,
  ])

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/admin/fixed-costs")
      if (response.ok) {
        const data = await response.json()
        const config = data.config
        setFormData({
          expectedRentals: config.expectedRentals?.toString() || "60",
          monthlyRentalsTarget: config.monthlyRentalsTarget?.toString() || "4",
          laborRatePerHour: config.laborRatePerHour?.toString() || "20",
          breakdownTimeHours: config.breakdownTimeHours?.toString() || "1",
          averageDistanceMiles: config.averageDistanceMiles?.toString() || "20",
          fuelCostPerMile: config.fuelCostPerMile?.toString() || "0.50",
          apiEmailCosts: config.apiEmailCosts?.toString() || "0.11",
          smsCostPerMessage: config.smsCostPerMessage?.toString() || "0.01",
          stripeFeeRate: config.stripeFeeRate?.toString() || "0.029",
          stripeFixedFee: config.stripeFixedFee?.toString() || "0.30",
          serverHostingMonthly: config.serverHostingMonthly?.toString() || "25",
          databaseMonthly: config.databaseMonthly?.toString() || "12",
          emailServiceMonthly: config.emailServiceMonthly?.toString() || "10",
          domainMonthly: config.domainMonthly?.toString() || "1",
          insuranceMonthly: config.insuranceMonthly?.toString() || "41.67",
          holidayMultiplier: config.holidayMultiplier?.toString() || "1.5",
        })
        setTotalMonthlyRecurring(data.config.totalMonthlyRecurring || 0)
        setBatteryCostsPerRental(data.config.batteryCostsPerRental || 0)
        setChargerCostsPerRental(data.config.chargerCostsPerRental || 0)
        setTotalBatteryChargerCosts(data.config.totalBatteryChargerCostsPerRental || 0)
      }
    } catch (error) {
      console.error("Error fetching config:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch("/api/admin/fixed-costs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedRentals: parseInt(formData.expectedRentals),
          monthlyRentalsTarget: parseInt(formData.monthlyRentalsTarget),
          laborRatePerHour: parseFloat(formData.laborRatePerHour),
          breakdownTimeHours: parseFloat(formData.breakdownTimeHours),
          averageDistanceMiles: parseFloat(formData.averageDistanceMiles),
          fuelCostPerMile: parseFloat(formData.fuelCostPerMile),
          apiEmailCosts: parseFloat(formData.apiEmailCosts),
          smsCostPerMessage: parseFloat(formData.smsCostPerMessage),
          stripeFeeRate: parseFloat(formData.stripeFeeRate),
          stripeFixedFee: parseFloat(formData.stripeFixedFee),
          serverHostingMonthly: parseFloat(formData.serverHostingMonthly),
          databaseMonthly: parseFloat(formData.databaseMonthly),
          emailServiceMonthly: parseFloat(formData.emailServiceMonthly),
          domainMonthly: parseFloat(formData.domainMonthly),
          insuranceMonthly: parseFloat(formData.insuranceMonthly),
          holidayMultiplier: parseFloat(formData.holidayMultiplier),
        }),
      })

      if (response.ok) {
        alert("Fixed costs configuration saved successfully!")
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to save configuration")
      }
    } catch (error) {
      console.error("Error saving config:", error)
      alert("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-6">Fixed Costs Configuration</h2>
      <p className="text-gray-600 mb-6">
        Configure the fixed cost variables used in break-even and profitability analysis.
        These values are used when creating and analyzing tracks.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Cost Variables</CardTitle>
          <CardDescription>
            Update the fixed cost parameters that affect break-even calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Equipment & Rentals */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Equipment & Rentals
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Expected Rentals Before Replacement *
                  </label>
                  <Input
                    name="expectedRentals"
                    type="number"
                    value={formData.expectedRentals}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of rentals expected before equipment replacement
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Monthly Rentals Target *
                  </label>
                  <Input
                    name="monthlyRentalsTarget"
                    type="number"
                    value={formData.monthlyRentalsTarget}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Target number of rentals per month
                  </p>
                </div>
              </div>
            </div>

            {/* Labor Costs */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Labor Costs</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Labor Rate per Hour ($) *
                  </label>
                  <Input
                    name="laborRatePerHour"
                    type="number"
                    step="0.01"
                    value={formData.laborRatePerHour}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Hourly wage for setup/breakdown labor
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Breakdown Time (hours) *
                  </label>
                  <Input
                    name="breakdownTimeHours"
                    type="number"
                    step="0.1"
                    value={formData.breakdownTimeHours}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Average breakdown time in hours
                  </p>
                </div>
              </div>
            </div>

            {/* Travel Costs */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Travel Costs</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Average Distance (miles) *
                  </label>
                  <Input
                    name="averageDistanceMiles"
                    type="number"
                    step="0.1"
                    value={formData.averageDistanceMiles}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Average distance to event location
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Fuel Cost per Mile ($) *
                  </label>
                  <Input
                    name="fuelCostPerMile"
                    type="number"
                    step="0.01"
                    value={formData.fuelCostPerMile}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cost per mile for fuel and vehicle wear
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly Recurring Costs */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Monthly Recurring Costs
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Server/Hosting ($/month) *
                  </label>
                  <Input
                    name="serverHostingMonthly"
                    type="number"
                    step="0.01"
                    value={formData.serverHostingMonthly}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Database ($/month) *
                  </label>
                  <Input
                    name="databaseMonthly"
                    type="number"
                    step="0.01"
                    value={formData.databaseMonthly}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email Service ($/month) *
                  </label>
                  <Input
                    name="emailServiceMonthly"
                    type="number"
                    step="0.01"
                    value={formData.emailServiceMonthly}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Domain ($/month) *
                  </label>
                  <Input
                    name="domainMonthly"
                    type="number"
                    step="0.01"
                    value={formData.domainMonthly}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Insurance ($/month) *
                  </label>
                  <Input
                    name="insuranceMonthly"
                    type="number"
                    step="0.01"
                    value={formData.insuranceMonthly}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    General liability insurance monthly cost
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Total Monthly Recurring
                  </label>
                  <Input
                    type="text"
                    value={`$${totalMonthlyRecurring.toFixed(2)}`}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically calculated
                  </p>
                </div>
              </div>
            </div>

            {/* Battery & Charger Costs */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-lg font-semibold">Battery & Charger Costs (Per Rental)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Battery and charger costs are automatically calculated from your Battery Management and Charger Management pages.
                  These costs are included in the break-even analysis for each track rental.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Battery Costs per Rental (8-hour average)
                  </label>
                  <Input
                    type="text"
                    value={`$${batteryCostsPerRental.toFixed(2)}`}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Includes battery amortization and labor costs
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Charger Costs per Rental
                  </label>
                  <Input
                    type="text"
                    value={`$${chargerCostsPerRental.toFixed(2)}`}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Charger amortization based on expected lifespan
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t mt-4">
                <label className="block text-sm font-medium">
                  Total Battery & Charger Costs per Rental
                </label>
                <span className="font-bold text-lg">${totalBatteryChargerCosts.toFixed(2)}</span>
              </div>
            </div>

            {/* Technology & Payment Processing */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Technology, Messaging & Payment Processing
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    API/Email Costs per Rental ($) *
                  </label>
                  <Input
                    name="apiEmailCosts"
                    type="number"
                    step="0.01"
                    value={formData.apiEmailCosts}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Google Maps API + Email service costs per rental
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    SMS Delivery Cost per Message ($) *
                  </label>
                  <Input
                    name="smsCostPerMessage"
                    type="number"
                    step="0.0001"
                    value={formData.smsCostPerMessage}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Per-SMS cost (e.g., Twilio). Used in profitability analysis.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Stripe Fee Rate (decimal) *
                  </label>
                  <Input
                    name="stripeFeeRate"
                    type="number"
                    step="0.0001"
                    value={formData.stripeFeeRate}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Stripe percentage fee (e.g., 0.029 for 2.9%)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Stripe Fixed Fee ($) *
                  </label>
                  <Input
                    name="stripeFixedFee"
                    type="number"
                    step="0.01"
                    value={formData.stripeFixedFee}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fixed fee per transaction
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
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

