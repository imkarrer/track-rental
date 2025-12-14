"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateCarBreakEven, CarBreakEvenResult, CarBreakEvenConfig } from "@/lib/pricing/car-break-even"

interface CarBreakEvenAnalysisProps {
  unitCost: string
  basePricePerDay: string
}

export function CarBreakEvenAnalysis({
  unitCost,
  basePricePerDay,
}: CarBreakEvenAnalysisProps) {
  const [fixedCostsConfig, setFixedCostsConfig] = useState<Partial<CarBreakEvenConfig> | null>(null)

  useEffect(() => {
    // Fetch fixed costs configuration
    fetchFixedCostsConfig()
  }, [])

  const fetchFixedCostsConfig = async () => {
    try {
      const response = await fetch("/api/admin/fixed-costs")
      if (response.ok) {
        const data = await response.json()
        const config = data.config
        
        // Convert to CarBreakEvenConfig format
        const totalMonthlyRecurring = data.config.totalMonthlyRecurring || 
          (Number(config.serverHostingMonthly || 0) +
           Number(config.databaseMonthly || 0) +
           Number(config.emailServiceMonthly || 0) +
           Number(config.domainMonthly || 0) +
           Number(config.insuranceMonthly || 0))

        setFixedCostsConfig({
          expectedRentals: config.expectedRentals || 100, // Default 100 for cars
          monthlyRecurringCosts: totalMonthlyRecurring,
          monthlyRentalsTarget: config.monthlyRentalsTarget || 4,
          averageDistanceMiles: Number(config.averageDistanceMiles || 20),
          fuelCostPerMile: Number(config.fuelCostPerMile || 0.5),
          apiEmailCosts: Number(config.apiEmailCosts || 0.11),
          stripeFeeRate: Number(config.stripeFeeRate || 0.029),
          stripeFixedFee: Number(config.stripeFixedFee || 0.3),
        })
      }
    } catch (error) {
      console.error("Error fetching fixed costs config:", error)
    }
  }

  const unitCostNum = parseFloat(unitCost) || 0
  const basePriceNum = parseFloat(basePricePerDay) || 0

  const analysis: CarBreakEvenResult | null = calculateCarBreakEven(
    basePriceNum,
    unitCostNum > 0 ? unitCostNum : null,
    fixedCostsConfig || undefined
  )

  if (!analysis) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-lg">Car Rental Price Analysis</CardTitle>
          <CardDescription>
            Enter unit cost to see profitability analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Add the car&apos;s purchase cost to see break-even and profitability metrics for setting the rental price.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isProfitable = analysis.profitPerRental > 0
  const isAboveBreakEven = basePriceNum >= analysis.breakEvenPricePerDay
  const profitColor = isProfitable ? "text-green-600" : "text-red-600"
  const marginColor = isProfitable ? "text-green-600" : "text-red-600"

  return (
    <Card className={isProfitable ? "border-green-200" : "border-red-200"}>
      <CardHeader>
        <CardTitle className="text-lg">Car Rental Price Analysis</CardTitle>
        <CardDescription>
          Break-even and profitability analysis for additional car rentals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Breakdown */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Cost Breakdown (Per Rental Day):</h4>
          <div className="text-sm space-y-1 pl-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Car Amortization:</span>
              <span>${analysis.fixedCostAmortization.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Monthly Costs (amortized):</span>
              <span>${analysis.monthlyCostPerRental.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Distance/Travel (shared):</span>
              <span>${analysis.distanceCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">API/Email Costs:</span>
              <span>${(analysis.totalVariableCosts - analysis.monthlyCostPerRental - analysis.distanceCost).toFixed(2)}</span>
            </div>
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
            <span className="font-semibold text-sm">Break-Even Price per Day:</span>
            <span className={`font-bold ${isAboveBreakEven ? "text-green-600" : "text-red-600"}`}>
              ${analysis.breakEvenPricePerDay.toFixed(2)}
            </span>
          </div>
          {!isAboveBreakEven && (
            <p className="text-xs text-red-600">
              Current price is ${(analysis.breakEvenPricePerDay - basePriceNum).toFixed(2)} below break-even
            </p>
          )}
        </div>

        {/* Profitability */}
        <div className="pt-2 border-t space-y-2">
          <h4 className="font-semibold text-sm">Profitability (at ${basePriceNum.toFixed(2)}/day):</h4>
          <div className="text-sm space-y-1 pl-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Revenue per Day:</span>
              <span>${analysis.revenuePerRental.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Net Revenue (after Stripe):</span>
              <span>${analysis.netRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="font-medium">Profit per Day:</span>
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
                <span className="text-gray-600">ROI (over {fixedCostsConfig?.expectedRentals || 100} rentals):</span>
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
                Current price results in a loss of ${Math.abs(analysis.profitPerRental).toFixed(2)} per day.
                Consider increasing the base price to at least ${analysis.breakEvenPricePerDay.toFixed(2)}/day.
              </p>
            </div>
          </div>
        )}

        {/* Note about additional cars */}
        <div className="pt-2 border-t">
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> This analysis is for additional cars (3rd, 4th, etc.) beyond the 2 free ones included with track rental.
              The first 2 cars are included FREE with the track, so this price only applies to additional cars.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

