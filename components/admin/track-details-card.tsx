"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Edit, Trash2, DollarSign, Car, Package, TrendingUp } from "lucide-react"

interface Car {
  id: string
  name: string
  unitCost?: number | null
  basePricePerDay?: number | null
  category: string
}

interface BreakEvenAnalysis {
  fixedCostAmortization: number
  monthlyCostPerRental: number
  laborCost: number
  distanceCost: number
  batteryCosts?: number
  totalVariableCosts: number
  totalCostsBeforeStripe: number
  breakEvenPrice: number
  revenuePerRental: number
  stripeFee: number
  netRevenue: number
  profitPerRental: number
  profitMargin: number
  breakEvenRentals: number
  paybackPeriodRentals: number
  roi: number
}

interface Track {
  id: string
  name: string
  description?: string | null
  length: number
  width: number
  basePrice: number
  unitCost?: number | null
  setupTimeMinutes?: number | null
  category: string
  isActive: boolean
  testOnly?: boolean
  includedCarIds: string[]
  includedCars: Car[]
  carCosts: number
  breakEvenAnalysis: BreakEvenAnalysis | null
}

interface TrackDetailsCardProps {
  track: Track
}

export function TrackDetailsCard({ track }: TrackDetailsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const isProfitable = track.breakEvenAnalysis
    ? track.breakEvenAnalysis.profitPerRental > 0
    : false
  const isAboveBreakEven = track.breakEvenAnalysis
    ? Number(track.basePrice) >= track.breakEvenAnalysis.breakEvenPrice
    : false

  return (
    <Card className="overflow-hidden">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{track.name}</CardTitle>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span>Size: {track.length}ft × {track.width}ft</span>
              <span>•</span>
              <span>Base Price: ${Number(track.basePrice).toFixed(2)}</span>
              <span>•</span>
              <span className={`font-medium ${track.isActive ? "text-green-600" : "text-red-600"}`}>
                {track.isActive ? "Active" : "Inactive"}
              </span>
              <span>•</span>
              <span className="capitalize">{track.category.toLowerCase()}</span>
              {track.testOnly && (
                <>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    🧪 Test Only
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {track.breakEvenAnalysis && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isProfitable && isAboveBreakEven
                  ? "bg-green-100 text-green-700"
                  : isAboveBreakEven
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {isProfitable && isAboveBreakEven
                  ? "Profitable"
                  : isAboveBreakEven
                  ? "At Break-Even"
                  : "Below Break-Even"}
              </div>
            )}
            <Button variant="ghost" size="sm">
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-6">
            {/* Description */}
            {track.description && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Description</h4>
                <p className="text-sm text-gray-600">{track.description}</p>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Setup Time</h4>
                <p className="text-sm text-gray-600">
                  {track.setupTimeMinutes ? `${track.setupTimeMinutes} minutes` : "Not set"}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Unit Cost</h4>
                <p className="text-sm text-gray-600">
                  {track.unitCost ? `$${Number(track.unitCost).toFixed(2)}` : "Not set"}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Category</h4>
                <p className="text-sm text-gray-600 capitalize">{track.category.toLowerCase()}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Status</h4>
                <p className={`text-sm font-medium ${track.isActive ? "text-green-600" : "text-red-600"}`}>
                  {track.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            </div>

            {/* Default Cars */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Car className="h-4 w-4" />
                Default Included Cars ({track.includedCars.length}/2)
              </h4>
              {track.includedCars.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    No cars selected. Please edit this track to select 2 default cars.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {track.includedCars.map((car) => (
                    <div
                      key={car.id}
                      className="border rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{car.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{car.category.toLowerCase()}</p>
                        </div>
                        {car.unitCost && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Unit Cost</p>
                            <p className="text-sm font-medium">${Number(car.unitCost).toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {track.carCosts > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Total Car Costs:</span> ${track.carCosts.toFixed(2)}
                </div>
              )}
            </div>

            {/* Cost Breakdown */}
            {track.breakEvenAnalysis ? (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Cost Breakdown & Profitability Analysis
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  {/* Cost Breakdown */}
                  <div>
                    <h5 className="font-medium text-sm mb-2 text-gray-700">Cost Breakdown (Per Rental):</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Equipment Amortization:</span>
                        <span>${track.breakEvenAnalysis.fixedCostAmortization.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monthly Recurring Costs:</span>
                        <span>${track.breakEvenAnalysis.monthlyCostPerRental.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Labor (Setup/Breakdown):</span>
                        <span>${track.breakEvenAnalysis.laborCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Distance/Travel:</span>
                        <span>${track.breakEvenAnalysis.distanceCost.toFixed(2)}</span>
                      </div>
                      {track.breakEvenAnalysis.batteryCosts && track.breakEvenAnalysis.batteryCosts > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Battery & Charger Costs:</span>
                          <span>${track.breakEvenAnalysis.batteryCosts.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t font-medium">
                        <span>Total Costs (before Stripe):</span>
                        <span>${track.breakEvenAnalysis.totalCostsBeforeStripe.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Stripe Fee (estimated):</span>
                        <span>${track.breakEvenAnalysis.stripeFee.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Break-Even */}
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">Break-Even Price:</span>
                      <span className={`font-bold text-lg ${isAboveBreakEven ? "text-green-600" : "text-red-600"}`}>
                        ${track.breakEvenAnalysis.breakEvenPrice.toFixed(2)}
                      </span>
                    </div>
                    {!isAboveBreakEven && (
                      <p className="text-xs text-red-600">
                        Current price is ${(track.breakEvenAnalysis.breakEvenPrice - Number(track.basePrice)).toFixed(2)} below break-even
                      </p>
                    )}
                  </div>

                  {/* Profitability */}
                  <div className="pt-2 border-t">
                    <h5 className="font-medium text-sm mb-2 text-gray-700">
                      Profitability (at ${Number(track.basePrice).toFixed(2)}):
                    </h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Revenue:</span>
                        <span>${track.breakEvenAnalysis.revenuePerRental.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Net Revenue (after Stripe):</span>
                        <span>${track.breakEvenAnalysis.netRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t font-medium">
                        <span>Profit per Rental:</span>
                        <span className={isProfitable ? "text-green-600" : "text-red-600"}>
                          ${track.breakEvenAnalysis.profitPerRental.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Profit Margin:</span>
                        <span className={`font-medium ${isProfitable ? "text-green-600" : "text-red-600"}`}>
                          {track.breakEvenAnalysis.profitMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ROI & Payback */}
                  {isProfitable && (
                    <div className="pt-2 border-t">
                      <h5 className="font-medium text-sm mb-2 text-gray-700">Return on Investment:</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">ROI:</span>
                          <span className={track.breakEvenAnalysis.roi > 0 ? "text-green-600 font-medium" : "text-red-600"}>
                            {track.breakEvenAnalysis.roi > 0 ? "+" : ""}{track.breakEvenAnalysis.roi.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payback Period:</span>
                          <span className="font-medium">
                            {track.breakEvenAnalysis.paybackPeriodRentals === Infinity
                              ? "Never"
                              : `${track.breakEvenAnalysis.paybackPeriodRentals} rental${track.breakEvenAnalysis.paybackPeriodRentals > 1 ? "s" : ""}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Break-Even Rentals:</span>
                          <span className="font-medium">
                            {track.breakEvenAnalysis.breakEvenRentals === Infinity
                              ? "Never"
                              : `${track.breakEvenAnalysis.breakEvenRentals} rental${track.breakEvenAnalysis.breakEvenRentals > 1 ? "s" : ""}`}
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
                          Current price results in a loss of ${Math.abs(track.breakEvenAnalysis.profitPerRental).toFixed(2)} per rental.
                          Consider increasing the base price to at least ${track.breakEvenAnalysis.breakEvenPrice.toFixed(2)}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Cost Analysis
                </h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    Cost analysis unavailable. Please set the track&apos;s unit cost and select 2 default cars to enable break-even analysis.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Link href={`/admin/tracks/${track.id}/edit`} className="flex-1">
                <Button variant="outline" className="w-full">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Track
                </Button>
              </Link>
              <Link href={`/admin/tracks/${track.id}/delete`} className="flex-1">
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

