import { prisma } from "@/lib/db/prisma"

export type ProgramId = "user" | "admin"

export type ProgramConfig = {
  id: ProgramId
  enabled: boolean
  referrerType: "PERCENT" | "FLAT"
  referrerPercentOff?: number
  referrerAmountOff?: number
  referrerApplyOnce: boolean
  refereeType: "PERCENT" | "FLAT"
  refereePercentOff?: number
  refereeAmountOff?: number
  refereeApplyOnce: boolean
}

const DEFAULTS: Record<ProgramId, ProgramConfig> = {
  user: {
    id: "user",
    enabled: true,
    referrerType: "PERCENT",
    referrerPercentOff: 5,
    referrerAmountOff: 0,
    referrerApplyOnce: false,
    refereeType: "PERCENT",
    refereePercentOff: 10,
    refereeAmountOff: 0,
    refereeApplyOnce: true,
  },
  admin: {
    id: "admin",
    enabled: true,
    referrerType: "PERCENT",
    referrerPercentOff: 0,
    referrerAmountOff: 0,
    referrerApplyOnce: false,
    refereeType: "PERCENT",
    refereePercentOff: 15,
    refereeAmountOff: 0,
    refereeApplyOnce: true,
  },
}

export async function getProgramConfigs(): Promise<Record<ProgramId, ProgramConfig>> {
  try {
    if (typeof (prisma as any).referralProgramConfig?.findMany !== "function") {
      return { ...DEFAULTS }
    }
    const rows = await prisma.referralProgramConfig.findMany()
    const out: Record<ProgramId, ProgramConfig> = { ...DEFAULTS }
    rows.forEach((r) => {
      const id = r.id as ProgramId
      out[id] = {
        id,
        enabled: r.enabled,
        referrerType: id === "admin" ? "PERCENT" : (r.referrerType as "PERCENT" | "FLAT") ?? "PERCENT",
        referrerPercentOff: id === "admin" ? 0 : r.referrerPercentOff ? Number(r.referrerPercentOff) : undefined,
        referrerAmountOff: id === "admin" ? 0 : r.referrerAmountOff ? Number(r.referrerAmountOff) : undefined,
        referrerApplyOnce: id === "user" ? false : id === "admin" ? false : r.referrerApplyOnce,
        refereeType: (r.refereeType as "PERCENT" | "FLAT") ?? "PERCENT",
        refereePercentOff: r.refereePercentOff ? Number(r.refereePercentOff) : undefined,
        refereeAmountOff: r.refereeAmountOff ? Number(r.refereeAmountOff) : undefined,
        refereeApplyOnce: r.refereeApplyOnce,
      }
    })
    return out
  } catch (error) {
    console.error("Falling back to default referral program config:", error)
    return { ...DEFAULTS }
  }
}

export async function setProgramConfigs(configs: Record<ProgramId, ProgramConfig>) {
  if (typeof (prisma as any).referralProgramConfig?.upsert !== "function") {
    throw new Error(
      "ReferralProgramConfig model not available. Run `npm run db:generate` and apply migrations."
    )
  }
  const entries = Object.values(configs)
  for (const cfg of entries) {
    const saveCfg = {
      ...cfg,
      referrerApplyOnce: cfg.id === "user" ? false : cfg.id === "admin" ? false : cfg.referrerApplyOnce,
      referrerPercentOff: cfg.id === "admin" ? 0 : cfg.referrerPercentOff,
      referrerAmountOff: cfg.id === "admin" ? 0 : cfg.referrerAmountOff,
    }
    await prisma.referralProgramConfig.upsert({
      where: { id: saveCfg.id },
      update: {
        enabled: saveCfg.enabled,
        referrerType: saveCfg.referrerType,
        referrerPercentOff: saveCfg.referrerPercentOff ?? null,
        referrerAmountOff: saveCfg.referrerAmountOff ?? null,
        referrerApplyOnce: saveCfg.referrerApplyOnce,
        refereeType: saveCfg.refereeType,
        refereePercentOff: saveCfg.refereePercentOff ?? null,
        refereeAmountOff: saveCfg.refereeAmountOff ?? null,
        refereeApplyOnce: saveCfg.refereeApplyOnce,
      },
      create: {
        id: saveCfg.id,
        enabled: saveCfg.enabled,
        referrerType: saveCfg.referrerType,
        referrerPercentOff: saveCfg.referrerPercentOff ?? null,
        referrerAmountOff: saveCfg.referrerAmountOff ?? null,
        referrerApplyOnce: saveCfg.referrerApplyOnce,
        refereeType: saveCfg.refereeType,
        refereePercentOff: saveCfg.refereePercentOff ?? null,
        refereeAmountOff: saveCfg.refereeAmountOff ?? null,
        refereeApplyOnce: saveCfg.refereeApplyOnce,
      },
    })
  }
}

export function computeDiscount(
  total: number,
  type: "PERCENT" | "FLAT",
  percent?: number,
  amount?: number
): number {
  if (total <= 0) return 0
  if (type === "PERCENT") {
    const pct = Math.max(0, Math.min(percent ?? 0, 100))
    return (total * pct) / 100
  }
  return Math.max(0, Math.min(amount ?? 0, total))
}


