/**
 * Break-even and profitability analysis for cars
 * Cars are simpler than tracks - no setup time, but still have costs
 */

import { BreakEvenConfig } from "./break-even"

export interface CarBreakEvenConfig {
  // Fixed costs
  unitCost: number // Car purchase cost
  expectedRentals: number // Expected rentals before replacement (default: 100 for cars)
  
  // Variable costs per rental (from fixed costs config)
  monthlyRecurringCosts: number // Monthly recurring costs (amortized per rental)
  monthlyRentalsTarget: number // Target rentals per month
  averageDistanceMiles: number // Average distance to event
  fuelCostPerMile: number // Fuel cost per mile
  apiEmailCosts: number // API and email costs per rental
  
  // Payment processing
  stripeFeeRate: number // Stripe fee percentage
  stripeFixedFee: number // Stripe fixed fee per transaction
}

export interface CarBreakEvenResult {
  // Cost breakdown
  fixedCostAmortization: number // Car cost per rental
  monthlyCostPerRental: number // Monthly recurring costs per rental (amortized)
  distanceCost: number // Travel/fuel cost (shared with track, so minimal per car)
  totalVariableCosts: number // All variable costs before Stripe
  totalCostsBeforeStripe: number // Total costs before payment processing
  
  // Break-even
  breakEvenRevenue: number // Minimum revenue needed to break even
  breakEvenPricePerDay: number // Minimum base price per day
  
  // Profitability (at given base price)
  basePricePerDay: number // Current base price being analyzed
  revenuePerRental: number // Revenue at base price
  stripeFee: number // Stripe fee at this price
  netRevenue: number // Revenue after Stripe fee
  profitPerRental: number // Profit per rental
  profitMargin: number // Profit margin percentage
  breakEvenRentals: number // Number of rentals needed to cover unit cost
  
  // ROI
  roi: number // Return on investment percentage
  paybackPeriodRentals: number // Number of rentals to pay back unit cost
}

const DEFAULT_CAR_CONFIG: Partial<CarBreakEvenConfig> = {
  expectedRentals: 100, // Cars typically last longer than tracks (more rentals)
}

/**
 * Calculate break-even and profitability analysis for a car
 * Cars have simpler cost structure - no setup/breakdown labor
 */
export function calculateCarBreakEven(
  basePricePerDay: number,
  unitCost: number | null,
  config?: Partial<CarBreakEvenConfig>
): CarBreakEvenResult | null {
  if (!unitCost || unitCost <= 0) {
    return null
  }

  const cfg = {
    ...DEFAULT_CAR_CONFIG,
    ...config,
  } as CarBreakEvenConfig

  // 1. Fixed Cost Amortization (Car only)
  const fixedCostAmortization = unitCost / cfg.expectedRentals

  // 2. Monthly Cost per Rental (amortized)
  // Note: Monthly costs are shared across all rentals (track + cars)
  // For individual car analysis, we use a smaller portion
  // Assuming 4 cars per rental on average, each car gets 1/4 of monthly costs
  const monthlyCostPerRental = cfg.monthlyRecurringCosts / cfg.monthlyRentalsTarget / 4

  // 3. Distance Cost (minimal per car - shared with track)
  // Cars are transported with the track, so minimal additional cost
  const distanceCost = (cfg.averageDistanceMiles * cfg.fuelCostPerMile) / 4 // Shared across 4 cars

  // 4. Total Variable Costs (before Stripe)
  const totalVariableCosts = monthlyCostPerRental + distanceCost + cfg.apiEmailCosts

  // 5. Total Costs (before Stripe)
  const totalCostsBeforeStripe = fixedCostAmortization + totalVariableCosts

  // 6. Break-Even Revenue (including Stripe fee)
  const breakEvenRevenue =
    (totalCostsBeforeStripe + cfg.stripeFixedFee) / (1 - cfg.stripeFeeRate)

  // Break-even base price per day
  const breakEvenPricePerDay = breakEvenRevenue

  // 7. Profitability at given base price
  const revenuePerRental = basePricePerDay
  const stripeFee = revenuePerRental * cfg.stripeFeeRate + cfg.stripeFixedFee
  const netRevenue = revenuePerRental - stripeFee
  const profitPerRental = netRevenue - totalCostsBeforeStripe
  const profitMargin = revenuePerRental > 0 ? (profitPerRental / revenuePerRental) * 100 : 0

  // 8. Break-even rentals to cover unit cost
  const breakEvenRentals = profitPerRental > 0 ? Math.ceil(unitCost / profitPerRental) : Infinity

  // 9. ROI and Payback Period
  const roi = profitPerRental > 0 
    ? ((profitPerRental * cfg.expectedRentals - unitCost) / unitCost) * 100 
    : -100
  const paybackPeriodRentals = profitPerRental > 0 
    ? Math.ceil(unitCost / profitPerRental) 
    : Infinity

  return {
    fixedCostAmortization: Math.round(fixedCostAmortization * 100) / 100,
    monthlyCostPerRental: Math.round(monthlyCostPerRental * 100) / 100,
    distanceCost: Math.round(distanceCost * 100) / 100,
    totalVariableCosts: Math.round(totalVariableCosts * 100) / 100,
    totalCostsBeforeStripe: Math.round(totalCostsBeforeStripe * 100) / 100,
    breakEvenRevenue: Math.round(breakEvenRevenue * 100) / 100,
    breakEvenPricePerDay: Math.round(breakEvenPricePerDay * 100) / 100,
    basePricePerDay,
    revenuePerRental: Math.round(revenuePerRental * 100) / 100,
    stripeFee: Math.round(stripeFee * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    profitPerRental: Math.round(profitPerRental * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    breakEvenRentals,
    roi: Math.round(roi * 100) / 100,
    paybackPeriodRentals,
  }
}

