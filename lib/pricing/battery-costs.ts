/**
 * Calculate battery costs per rental based on battery batches
 * Charger costs are calculated separately and added to fixed costs
 */

import { prisma } from "@/lib/db/prisma"

export interface BatteryCostResult {
  carBatteryCost: number
  transmitterBatteryCost: number
  totalBatteryCost: number
  batterySwapLaborCost: number
  chargingLaborCost: number
  totalCost: number
}

export interface ChargerCostResult {
  carChargerCost: number
  transmitterChargerCost: number
  totalChargerCost: number
}

/**
 * Calculate battery costs for a rental
 * @param durationHours - Rental duration in hours
 * @param category - Track category (ROAD or OFFROAD)
 * @param laborRatePerHour - Hourly labor rate for battery swaps
 * @returns Battery cost breakdown
 */
export async function calculateBatteryCosts(
  durationHours: number,
  category: "ROAD" | "OFFROAD",
  laborRatePerHour: number = 20
): Promise<BatteryCostResult> {
  // Fetch active battery batches
  const carBatteries = await prisma.batteryBatch.findMany({
    where: {
      usage: "CAR",
      isActive: true,
    },
  })

  const transmitterBatteries = await prisma.batteryBatch.findMany({
    where: {
      usage: "TRANSMITTER",
      isActive: true,
    },
  })

  // Calculate car battery costs
  let carBatteryCost = 0
  let carBatterySwapCount = 0

  if (carBatteries.length > 0) {
    // Use the first active batch (could be enhanced to use weighted average)
    const carBatch = carBatteries[0]
    const runtimeMinutes = category === "ROAD"
      ? Number(carBatch.expectedRuntimeRoad || 30)
      : Number(carBatch.expectedRuntimeOffroad || 30)

    // Calculate how many battery changes needed
    const durationMinutes = durationHours * 60
    const batteryChanges = Math.ceil(durationMinutes / runtimeMinutes)
    carBatterySwapCount = batteryChanges * 4 // 4 cars

    // Calculate cost per battery change
    if (carBatch.batteryType === "LITHIUM_DISPOSABLE" || carBatch.batteryType === "ALKALINE") {
      // Disposable: cost per battery × batteries per change
      const costPerBattery = Number(carBatch.purchaseCost) / carBatch.quantity
      carBatteryCost = costPerBattery * 4 * batteryChanges // 4 batteries per car × number of changes
    } else {
      // Rechargeable: amortize cost over expected cycles
      const costPerBattery = Number(carBatch.purchaseCost) / carBatch.quantity
      const costPerCycle = costPerBattery / (carBatch.expectedCycles || 500)
      carBatteryCost = costPerCycle * 4 * batteryChanges
    }
  }

  // Calculate transmitter battery costs (last all day, so only 1 set needed)
  let transmitterBatteryCost = 0

  if (transmitterBatteries.length > 0) {
    const transmitterBatch = transmitterBatteries[0]
    
    if (transmitterBatch.batteryType === "LITHIUM_DISPOSABLE" || transmitterBatch.batteryType === "ALKALINE") {
      // Disposable: cost per battery × 4 batteries (1 set)
      const costPerBattery = Number(transmitterBatch.purchaseCost) / transmitterBatch.quantity
      transmitterBatteryCost = costPerBattery * 4
    } else {
      // Rechargeable: amortize cost over expected cycles
      const costPerBattery = Number(transmitterBatch.purchaseCost) / transmitterBatch.quantity
      const costPerCycle = costPerBattery / (transmitterBatch.expectedCycles || 500)
      transmitterBatteryCost = costPerCycle * 4
    }
  }

  // Calculate labor costs
  // Battery swap labor: 1 minute per swap
  const batterySwapLaborHours = (carBatterySwapCount * 1) / 60
  const batterySwapLaborCost = batterySwapLaborHours * laborRatePerHour

  // Charging labor: 10 minutes total (5 min load + 5 min unload)
  const chargingLaborHours = 10 / 60
  const chargingLaborCost = chargingLaborHours * laborRatePerHour

  const totalBatteryCost = carBatteryCost + transmitterBatteryCost
  const totalCost = totalBatteryCost + batterySwapLaborCost + chargingLaborCost

  return {
    carBatteryCost: Math.round(carBatteryCost * 100) / 100,
    transmitterBatteryCost: Math.round(transmitterBatteryCost * 100) / 100,
    totalBatteryCost: Math.round(totalBatteryCost * 100) / 100,
    batterySwapLaborCost: Math.round(batterySwapLaborCost * 100) / 100,
    chargingLaborCost: Math.round(chargingLaborCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
  }
}

