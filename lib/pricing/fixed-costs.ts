/**
 * Fetch fixed costs configuration from the database
 * Falls back to defaults if not configured
 */

import { prisma } from "@/lib/db/prisma"
import { BreakEvenConfig } from "./break-even"

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

export async function getFixedCostsConfig(): Promise<BreakEvenConfig> {
  try {
    const config = await prisma.fixedCostsConfig.findFirst()

    if (!config) {
      return DEFAULT_CONFIG
    }

    // Calculate total monthly recurring costs
    const totalMonthlyRecurring =
      Number(config.serverHostingMonthly) +
      Number(config.databaseMonthly) +
      Number(config.emailServiceMonthly) +
      Number(config.domainMonthly) +
      Number(config.insuranceMonthly)

    return {
      unitCost: DEFAULT_CONFIG.unitCost, // Track-specific, not from config
      carCosts: DEFAULT_CONFIG.carCosts, // Track-specific, not from config
      expectedRentals: config.expectedRentals,
      monthlyRecurringCosts: totalMonthlyRecurring,
      monthlyRentalsTarget: config.monthlyRentalsTarget,
      laborRatePerHour: Number(config.laborRatePerHour),
      setupTimeHours: DEFAULT_CONFIG.setupTimeHours, // Track-specific, not from config
      breakdownTimeHours: Number(config.breakdownTimeHours),
      averageDistanceMiles: Number(config.averageDistanceMiles),
      fuelCostPerMile: Number(config.fuelCostPerMile),
      apiEmailCosts: Number(config.apiEmailCosts),
      batteryCosts: DEFAULT_CONFIG.batteryCosts, // Track-specific, not from config
      stripeFeeRate: Number(config.stripeFeeRate),
      stripeFixedFee: Number(config.stripeFixedFee),
    }
  } catch (error) {
    console.error("Error fetching fixed costs config:", error)
    return DEFAULT_CONFIG
  }
}

