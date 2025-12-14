import { prisma } from "@/lib/db/prisma"

export type ReferralIncentiveConfig = {
  type: "PERCENT" | "FLAT"
  percentOff?: number
  amountOff?: number
  applyOnce: boolean
}

export async function getReferralIncentive(): Promise<ReferralIncentiveConfig> {
  // Note: ReferralIncentive model no longer exists in Prisma schema
  // Returning default values
  return { type: "PERCENT", percentOff: 10, applyOnce: true }
}

export async function setReferralIncentive(config: ReferralIncentiveConfig) {
  // Note: ReferralIncentive model no longer exists in Prisma schema
  // This function is a no-op for now
  console.warn("setReferralIncentive called but ReferralIncentive model does not exist")
}

export function computeReferralDiscount(total: number, cfg: ReferralIncentiveConfig): number {
  if (total <= 0) return 0
  if (cfg.type === "PERCENT") {
    const pct = Math.max(0, Math.min(cfg.percentOff ?? 0, 100))
    return (total * pct) / 100
  }
  return Math.max(0, Math.min(cfg.amountOff ?? 0, total))
}


