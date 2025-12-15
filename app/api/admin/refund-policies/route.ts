import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const refundPolicySchema = z.object({
  daysBeforeService: z.number().int().min(0),
  nonRefundablePercent: z.number().min(0).max(100),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// GET - List all refund policies
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const policies = await prisma.refundPolicy.findMany({
      orderBy: { daysBeforeService: "desc" },
    })

    return NextResponse.json({ policies })
  } catch (error) {
    console.error("Error fetching refund policies:", error)
    return NextResponse.json(
      { error: "Failed to fetch refund policies" },
      { status: 500 }
    )
  }
}

// POST - Create a new refund policy
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = refundPolicySchema.parse(body)

    // Check if policy with same daysBeforeService already exists
    const existing = await prisma.refundPolicy.findUnique({
      where: { daysBeforeService: data.daysBeforeService },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A policy with this number of days already exists" },
        { status: 400 }
      )
    }

    const policy = await prisma.refundPolicy.create({
      data: {
        daysBeforeService: data.daysBeforeService,
        nonRefundablePercent: data.nonRefundablePercent,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
      },
    })

    return NextResponse.json({ policy })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating refund policy:", error)
    return NextResponse.json(
      { error: "Failed to create refund policy" },
      { status: 500 }
    )
  }
}

