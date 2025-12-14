import { prisma } from "@/lib/db/prisma"

export type ReferralIncentiveConfig = {
  type: "PERCENT" | "FLAT"
  percentOff?: number
  amountOff?: number
  applyOnce: boolean
}

export async function getReferralIncentive(): Promise<ReferralIncentiveConfig> {
  const rec = await prisma.referralIncentive.findUnique({ where: { id: "default" } })
  if (!rec) {
    return { type: "PERCENT", percentOff: 10, applyOnce: true }
  }
  return {
    type: (rec.type as "PERCENT" | "FLAT") ?? "PERCENT",
    percentOff: rec.percentOff ? Number(rec.percentOff) : undefined,
    amountOff: rec.amountOff ? Number(rec.amountOff) : undefined,
    applyOnce: rec.applyOnce,
  }
}

export async function setReferralIncentive(config: ReferralIncentiveConfig) {
  await prisma.referralIncentive.upsert({
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


