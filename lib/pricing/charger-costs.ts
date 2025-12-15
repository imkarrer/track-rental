/**
 * Calculate charger costs per rental
 * Chargers are amortized over their expected lifespan and included in fixed costs
 */

import { prisma } from "@/lib/db/prisma"

export interface ChargerCostResult {
  carChargerCost: number
  transmitterChargerCost: number
  totalChargerCost: number
}

/**
 * Calculate charger amortization costs per rental
 * @param monthlyRentalsTarget - Target rentals per month for amortization
 * @returns Charger cost breakdown
 */
export async function calculateChargerCosts(
  monthlyRentalsTarget: number = 4
): Promise<ChargerCostResult> {
  // Fetch active chargers
  const carChargers = await prisma.charger.findMany({
    where: {
      batteryType: { in: ["LIION", "NIMH"] }, // Only rechargeable batteries need chargers
      isActive: true,
    },
  })

  // Separate car and transmitter chargers based on battery type
  // For now, we'll use the first charger of each type
  // In a more sophisticated system, you might match chargers to specific battery batches
  const carCharger = carChargers.find(c => c.batteryType === "LIION") || carChargers[0]
  const transmitterCharger = carChargers.find(c => c.batteryType === "NIMH") || carChargers.find(c => c.batteryType === "LIION") || carChargers[0]

  let carChargerCost = 0
  let transmitterChargerCost = 0

  // Calculate car charger amortization
  if (carCharger) {
    const expectedLifespanYears = carCharger.expectedLifespanYears || 5
    const totalRentals = monthlyRentalsTarget * 12 * expectedLifespanYears
    carChargerCost = Number(carCharger.purchaseCost) / totalRentals
  }

  // Calculate transmitter charger amortization
  if (transmitterCharger) {
    const expectedLifespanYears = transmitterCharger.expectedLifespanYears || 5
    const totalRentals = monthlyRentalsTarget * 12 * expectedLifespanYears
    transmitterChargerCost = Number(transmitterCharger.purchaseCost) / totalRentals
  }

  const totalChargerCost = carChargerCost + transmitterChargerCost

  return {
    carChargerCost: Math.round(carChargerCost * 100) / 100,
    transmitterChargerCost: Math.round(transmitterChargerCost * 100) / 100,
    totalChargerCost: Math.round(totalChargerCost * 100) / 100,
  }
}

