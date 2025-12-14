import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { getProgramConfigs, setProgramConfigs, ProgramId, ProgramConfig } from "@/lib/referrals/program-config"
import { z } from "zod"

const programSchema = z.object({
  id: z.enum(["user", "admin"]),
  enabled: z.boolean().default(true),
  referrerType: z.enum(["PERCENT", "FLAT"]),
  referrerPercentOff: z.number().min(0).max(100).optional(),
  referrerAmountOff: z.number().min(0).optional(),
  referrerApplyOnce: z.boolean().default(true),
  refereeType: z.enum(["PERCENT", "FLAT"]),
  refereePercentOff: z.number().min(0).max(100).optional(),
  refereeAmountOff: z.number().min(0).optional(),
  refereeApplyOnce: z.boolean().default(true),
})

export async function GET() {
  const cfgs = await getProgramConfigs()
  return NextResponse.json({ programs: cfgs })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const programsInput = z.array(programSchema).parse(body.programs)
    const cfgs: Record<ProgramId, ProgramConfig> = {} as any
    programsInput.forEach((p) => {
      cfgs[p.id as ProgramId] = p as ProgramConfig
    })
    await setProgramConfigs(cfgs)
    return NextResponse.json({ programs: cfgs })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to save incentive. Ensure the referral tables are migrated."
    console.error("Failed to save referral incentive:", error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


