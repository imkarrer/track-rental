/**
 * Break-even and profitability analysis for tracks
 * Based on cost structure from COST_AND_INSURANCE_ANALYSIS.md
 */

export interface BreakEvenConfig {
  // Fixed costs
  unitCost: number // Track purchase cost
  carCosts: number // Total cost of included cars (default: 0)
  expectedRentals: number // Expected rentals before replacement (default: 60)
  
  // Variable costs per rental
  monthlyRecurringCosts: number // Monthly recurring costs (default: $89.67)
  monthlyRentalsTarget: number // Target rentals per month (default: 4)
  laborRatePerHour: number // Hourly wage for setup/breakdown (default: $20)
  setupTimeHours: number // Setup time in hours
  breakdownTimeHours: number // Breakdown time in hours (default: 1)
  averageDistanceMiles: number // Average distance to event (default: 20)
  fuelCostPerMile: number // Fuel cost per mile (default: $0.50)
  apiEmailCosts: number // API and email costs per rental (default: $0.11)
  batteryCosts: number // Battery costs per rental (default: 0)
  
  // Payment processing
  stripeFeeRate: number // Stripe fee percentage (default: 0.029 = 2.9%)
  stripeFixedFee: number // Stripe fixed fee per transaction (default: $0.30)
}

export interface BreakEvenResult {
  // Cost breakdown
  fixedCostAmortization: number // Equipment cost per rental
  monthlyCostPerRental: number // Monthly recurring costs per rental
  laborCost: number // Setup + breakdown labor cost
  distanceCost: number // Travel/fuel cost
  batteryCosts?: number // Battery and charger costs per rental
  totalVariableCosts: number // All variable costs before Stripe
  totalCostsBeforeStripe: number // Total costs before payment processing
  
  // Break-even
  breakEvenRevenue: number // Minimum revenue needed to break even
  breakEvenPrice: number // Minimum base price (before multipliers)
  
  // Profitability (at given base price)
  basePrice: number // Current base price being analyzed
  revenuePerRental: number // Revenue at base price (before multipliers)
  stripeFee: number // Stripe fee at this price
  netRevenue: number // Revenue after Stripe fee
  profitPerRental: number // Profit per rental
  profitMargin: number // Profit margin percentage
  breakEvenRentals: number // Number of rentals needed to cover unit cost
  
  // ROI
  roi: number // Return on investment percentage
  paybackPeriodRentals: number // Number of rentals to pay back unit cost
}

const DEFAULT_CONFIG: BreakEvenConfig = {
  unitCost: 2000,
  carCosts: 0,
  expectedRentals: 60,
  monthlyRecurringCosts: 89.67,
  monthlyRentalsTarget: 4,
  laborRatePerHour: 20,
  setupTimeHours: 1,
  breakdownTimeHours: 1,
  averageDistanceMiles: 20,
  fuelCostPerMile: 0.5,
  apiEmailCosts: 0.11,
  batteryCosts: 0,
  stripeFeeRate: 0.029,
  stripeFixedFee: 0.3,
}

/**
 * Calculate break-even and profitability analysis
 */
export function calculateBreakEven(
  basePrice: number,
  unitCost: number | null,
  setupTimeMinutes: number,
  carCosts: number = 0,
  config?: Partial<BreakEvenConfig>
): BreakEvenResult | null {
  if (!unitCost || unitCost <= 0) {
    return null
  }

  const cfg = { ...DEFAULT_CONFIG, carCosts, ...config }
  const setupTimeHours = setupTimeMinutes / 60

  // 1. Fixed Cost Amortization (Track + Cars)
  const totalEquipmentCost = unitCost + cfg.carCosts
  const fixedCostAmortization = totalEquipmentCost / cfg.expectedRentals

  // 2. Monthly Cost per Rental
  const monthlyCostPerRental = cfg.monthlyRecurringCosts / cfg.monthlyRentalsTarget

  // 3. Labor Cost
  const laborCost = (setupTimeHours + cfg.breakdownTimeHours) * cfg.laborRatePerHour

  // 4. Distance Cost
  const distanceCost = cfg.averageDistanceMiles * cfg.fuelCostPerMile

  // 5. Total Variable Costs (before Stripe)
  const totalVariableCosts =
    monthlyCostPerRental + laborCost + distanceCost + cfg.apiEmailCosts + (cfg.batteryCosts || 0)

  // 6. Total Costs (before Stripe)
  const totalCostsBeforeStripe = fixedCostAmortization + totalVariableCosts

  // 7. Break-Even Revenue (including Stripe fee)
  // Revenue = (Total Costs + Stripe Fixed Fee) / (1 - Stripe Fee Rate)
  const breakEvenRevenue =
    (totalCostsBeforeStripe + cfg.stripeFixedFee) / (1 - cfg.stripeFeeRate)

  // Break-even base price (assuming no multipliers)
  const breakEvenPrice = breakEvenRevenue

  // 8. Profitability at given base price
  const revenuePerRental = basePrice
  const stripeFee = revenuePerRental * cfg.stripeFeeRate + cfg.stripeFixedFee
  const netRevenue = revenuePerRental - stripeFee
  const profitPerRental = netRevenue - totalCostsBeforeStripe
  const profitMargin = revenuePerRental > 0 ? (profitPerRental / revenuePerRental) * 100 : 0

  // 9. Break-even rentals to cover unit cost
  const breakEvenRentals = profitPerRental > 0 ? Math.ceil(unitCost / profitPerRental) : Infinity

  // 10. ROI and Payback Period
  const roi = profitPerRental > 0 ? ((profitPerRental * cfg.expectedRentals - unitCost) / unitCost) * 100 : -100
  const paybackPeriodRentals = profitPerRental > 0 ? Math.ceil(unitCost / profitPerRental) : Infinity

  return {
    fixedCostAmortization: Math.round(fixedCostAmortization * 100) / 100,
    monthlyCostPerRental: Math.round(monthlyCostPerRental * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    distanceCost: Math.round(distanceCost * 100) / 100,
    batteryCosts: cfg.batteryCosts ? Math.round(cfg.batteryCosts * 100) / 100 : undefined,
    totalVariableCosts: Math.round(totalVariableCosts * 100) / 100,
    totalCostsBeforeStripe: Math.round(totalCostsBeforeStripe * 100) / 100,
    breakEvenRevenue: Math.round(breakEvenRevenue * 100) / 100,
    breakEvenPrice: Math.round(breakEvenPrice * 100) / 100,
    basePrice,
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

