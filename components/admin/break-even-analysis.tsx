"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateBreakEven, BreakEvenResult, BreakEvenConfig } from "@/lib/pricing/break-even"

interface Car {
  id: string
  unitCost?: number | null
}

interface BreakEvenAnalysisProps {
  unitCost: string
  basePrice: string
  setupTimeMinutes: string
  includedCarIds?: string[]
  category?: "ROAD" | "OFFROAD"
}

export function BreakEvenAnalysis({
  unitCost,
  basePrice,
  setupTimeMinutes,
  includedCarIds = [],
  category = "ROAD",
}: BreakEvenAnalysisProps) {
  const [carCosts, setCarCosts] = useState(0)
  const [batteryCosts, setBatteryCosts] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fixedCostsConfig, setFixedCostsConfig] = useState<Partial<BreakEvenConfig> | null>(null)

  useEffect(() => {
    // Fetch fixed costs configuration first
    fetchFixedCostsConfig()
  }, [])

  useEffect(() => {
    // Fetch battery costs after fixed costs config is loaded
    if (fixedCostsConfig) {
      fetchBatteryCosts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedCostsConfig, category])

  useEffect(() => {
    if (includedCarIds && includedCarIds.length > 0) {
      fetchCarCosts()
    } else {
      setCarCosts(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includedCarIds])

  const fetchFixedCostsConfig = async () => {
    try {
      const response = await fetch("/api/admin/fixed-costs")
      if (response.ok) {
        const data = await response.json()
        const config = data.config
        
        // Convert to BreakEvenConfig format
        const totalMonthlyRecurring = data.config.totalMonthlyRecurring || 
          (Number(config.serverHostingMonthly || 0) +
           Number(config.databaseMonthly || 0) +
           Number(config.emailServiceMonthly || 0) +
           Number(config.domainMonthly || 0) +
           Number(config.insuranceMonthly || 0))

        setFixedCostsConfig({
          expectedRentals: config.expectedRentals,
          monthlyRecurringCosts: totalMonthlyRecurring,
          monthlyRentalsTarget: config.monthlyRentalsTarget,
          laborRatePerHour: Number(config.laborRatePerHour),
          breakdownTimeHours: Number(config.breakdownTimeHours),
          averageDistanceMiles: Number(config.averageDistanceMiles),
          fuelCostPerMile: Number(config.fuelCostPerMile),
          apiEmailCosts: Number(config.apiEmailCosts),
          stripeFeeRate: Number(config.stripeFeeRate),
          stripeFixedFee: Number(config.stripeFixedFee),
        })
      }
    } catch (error) {
      console.error("Error fetching fixed costs config:", error)
    }
  }

  const fetchCarCosts = async () => {
    if (!includedCarIds || includedCarIds.length === 0) {
      setCarCosts(0)
      return
    }

    setLoading(true)
    try {
      const carPromises = includedCarIds.map((carId) =>
        fetch(`/api/cars/${carId}`).then((res) => res.json())
      )
      const carData = await Promise.all(carPromises)
      const totalCarCost = carData.reduce((sum, data) => {
        const car = data.car
        return sum + (car?.unitCost ? Number(car.unitCost) : 0)
      }, 0)
      setCarCosts(totalCarCost)
    } catch (error) {
      console.error("Error fetching car costs:", error)
      setCarCosts(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchBatteryCosts = async () => {
    try {
      // Use average 8-hour rental for break-even calculation
      // Wait for fixedCostsConfig to be loaded first
      if (!fixedCostsConfig) return
      
      const trackCategory = category || "ROAD" // Default to ROAD if not provided
      
      // Fetch both battery and charger costs
      const [batteryResponse, chargerResponse] = await Promise.all([
        fetch(
          `/api/admin/batteries/costs?durationHours=8&category=${trackCategory}&laborRatePerHour=${fixedCostsConfig.laborRatePerHour || 20}`
        ),
        fetch(
          `/api/admin/chargers/costs?monthlyRentalsTarget=${fixedCostsConfig.monthlyRentalsTarget || 4}`
        ),
      ])
      
      let totalBatteryChargerCosts = 0
      
      if (batteryResponse.ok) {
        const batteryData = await batteryResponse.json()
        totalBatteryChargerCosts += batteryData.costs.totalCost
      }
      
      if (chargerResponse.ok) {
        const chargerData = await chargerResponse.json()
        totalBatteryChargerCosts += chargerData.costs.totalChargerCost
      }
      
      setBatteryCosts(totalBatteryChargerCosts)
    } catch (error) {
      console.error("Error fetching battery/charger costs:", error)
      setBatteryCosts(0)
    }
  }

  const unitCostNum = parseFloat(unitCost) || 0
  const basePriceNum = parseFloat(basePrice) || 0
  const setupTimeNum = parseInt(setupTimeMinutes) || 0

  const analysis: BreakEvenResult | null = calculateBreakEven(
    basePriceNum,
    unitCostNum > 0 ? unitCostNum : null,
    setupTimeNum,
    carCosts,
    { ...fixedCostsConfig, batteryCosts } || undefined
  )

  if (!analysis) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-lg">Break-Even Analysis</CardTitle>
          <CardDescription>
            Enter unit cost to see profitability analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {(!includedCarIds || includedCarIds.length < 2)
              ? "Please select 2 cars and add the track's purchase cost to see break-even and profitability metrics."
              : "Add the track's purchase cost to see break-even and profitability metrics."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const isProfitable = analysis.profitPerRental > 0
  const isAboveBreakEven = basePriceNum >= analysis.breakEvenPrice
  const profitColor = isProfitable ? "text-green-600" : "text-red-600"
  const marginColor = isProfitable ? "text-green-600" : "text-red-600"

  return (
    <Card className={isProfitable ? "border-green-200" : "border-red-200"}>
      <CardHeader>
        <CardTitle className="text-lg">Break-Even & Profitability Analysis</CardTitle>
        <CardDescription>
          Real-time analysis based on cost structure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Breakdown */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Cost Breakdown (Per Rental):</h4>
          <div className="text-sm space-y-1 pl-4">
            {carCosts > 0 && (
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Total Equipment Cost:</span>
                <span>${(unitCostNum + carCosts).toFixed(2)} (Track: ${unitCostNum.toFixed(2)} + Cars: ${carCosts.toFixed(2)})</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Equipment Amortization:</span>
              <span>${analysis.fixedCostAmortization.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Monthly Recurring Costs:</span>
              <span>${analysis.monthlyCostPerRental.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Labor (Setup/Breakdown):</span>
              <span>${analysis.laborCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Distance/Travel:</span>
              <span>${analysis.distanceCost.toFixed(2)}</span>
            </div>
            {batteryCosts > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Batteries:</span>
                <span>${batteryCosts.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t">
              <span className="font-medium">Total Costs (before Stripe):</span>
              <span className="font-medium">${analysis.totalCostsBeforeStripe.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Stripe Fee (estimated):</span>
              <span>${analysis.stripeFee.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Break-Even */}
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-sm">Break-Even Price:</span>
            <span className={`font-bold ${isAboveBreakEven ? "text-green-600" : "text-red-600"}`}>
              ${analysis.breakEvenPrice.toFixed(2)}
            </span>
          </div>
          {!isAboveBreakEven && (
            <p className="text-xs text-red-600">
              Current price is ${(analysis.breakEvenPrice - basePriceNum).toFixed(2)} below break-even
            </p>
          )}
        </div>

        {/* Profitability */}
        <div className="pt-2 border-t space-y-2">
          <h4 className="font-semibold text-sm">Profitability (at ${basePriceNum.toFixed(2)}):</h4>
          <div className="text-sm space-y-1 pl-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Revenue:</span>
              <span>${analysis.revenuePerRental.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Net Revenue (after Stripe):</span>
              <span>${analysis.netRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="font-medium">Profit per Rental:</span>
              <span className={`font-bold ${profitColor}`}>
                ${analysis.profitPerRental.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Profit Margin:</span>
              <span className={`font-medium ${marginColor}`}>
                {analysis.profitMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* ROI & Payback */}
        {isProfitable && (
          <div className="pt-2 border-t space-y-2">
            <h4 className="font-semibold text-sm">Return on Investment:</h4>
            <div className="text-sm space-y-1 pl-4">
              <div className="flex justify-between">
                <span className="text-gray-600">ROI (over {analysis.breakEvenRentals} rentals):</span>
                <span className={analysis.roi > 0 ? "text-green-600 font-medium" : "text-red-600"}>
                  {analysis.roi > 0 ? "+" : ""}{analysis.roi.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payback Period:</span>
                <span className="font-medium">
                  {analysis.paybackPeriodRentals === Infinity
                    ? "Never"
                    : `${analysis.paybackPeriodRentals} rental${analysis.paybackPeriodRentals > 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Break-Even Rentals:</span>
                <span className="font-medium">
                  {analysis.breakEvenRentals === Infinity
                    ? "Never"
                    : `${analysis.breakEvenRentals} rental${analysis.breakEvenRentals > 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Warning if not profitable */}
        {!isProfitable && (
          <div className="pt-2 border-t">
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800 font-medium">⚠️ Not Profitable</p>
              <p className="text-xs text-red-700 mt-1">
                Current price results in a loss of ${Math.abs(analysis.profitPerRental).toFixed(2)} per rental.
                Consider increasing the base price to at least ${analysis.breakEvenPrice.toFixed(2)}.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

