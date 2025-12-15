import { prisma } from "@/lib/db/prisma"

export type ReferralIncentiveConfig = {
  type: "PERCENT" | "FLAT"
  percentOff?: number
  amountOff?: number
  applyOnce: boolean
}

export async function getReferralIncentive(): Promise<ReferralIncentiveConfig> {
  const incentive = await (prisma as any).referralIncentive.findUnique({
    where: { id: "default" },
  })

  if (!incentive) {
    return { type: "PERCENT", percentOff: 10, applyOnce: true }
  }

  return {
    type: incentive.type as "PERCENT" | "FLAT",
    percentOff: incentive.percentOff != null ? Number(incentive.percentOff) : undefined,
    amountOff: incentive.amountOff != null ? Number(incentive.amountOff) : undefined,
    applyOnce: incentive.applyOnce,
  }
}

export async function setReferralIncentive(config: ReferralIncentiveConfig) {
  await (prisma as any).referralIncentive.upsert({
    where: { id: "default" },
    update: {
      type: config.type,
      percentOff: config.percentOff ?? null,
      amountOff: config.amountOff ?? null,
      applyOnce: config.applyOnce,
    },
    create: {
      id: "default",
      type: config.type,
      percentOff: config.percentOff ?? null,
      amountOff: config.amountOff ?? null,
      applyOnce: config.applyOnce,
    },
  })
}

export function computeReferralDiscount(total: number, cfg: ReferralIncentiveConfig): number {
  if (total <= 0) return 0
  if (cfg.type === "PERCENT") {
    const pct = Math.max(0, Math.min(cfg.percentOff ?? 0, 100))
    return (total * pct) / 100
  }
  return Math.max(0, Math.min(cfg.amountOff ?? 0, total))
}


