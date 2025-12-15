import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { generateCatchyCodeName, generatePromoCode } from "@/lib/referrals/code-generator"

const createPromoSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().min(1).default(100),
  generateName: z.boolean().optional(),
  generateCode: z.boolean().optional(),
})

const updatePromoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
})

// GET - List all admin promotional codes
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const promoCodes = await prisma.referralCode.findMany({
      where: {
        type: "ADMIN",
      },
      include: {
        redemptions: {
          include: {
            user: {
              select: { email: true, firstName: true, lastName: true, createdAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ promoCodes })
  } catch (error) {
    console.error("Error fetching promo codes:", error)
    return NextResponse.json({ error: "Failed to fetch promo codes" }, { status: 500 })
  }
}

// POST - Create new admin promotional code
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createPromoSchema.parse(body)

    // Generate catchy name if requested
    let name = data.name
    if (data.generateName || !name) {
      name = generateCatchyCodeName()
    }

    // Generate code if requested or not provided
    let code = data.code
    if (data.generateCode || !code) {
      code = generatePromoCode(name)
    }

    // Ensure code is uppercase and alphanumeric
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Check if code already exists
    const existing = await prisma.referralCode.findUnique({
      where: { code },
    })

    if (existing) {
      return NextResponse.json(
        { error: `Code "${code}" already exists. Please choose a different code.` },
        { status: 400 }
      )
    }

    // Create the promotional code
    const promoCode = await prisma.referralCode.create({
      data: {
        code,
        name,
        description: data.description,
        type: "ADMIN",
        maxUses: data.maxUses,
        ownerUserId: null, // Admin codes have no owner
        isActive: true,
      },
    })

    return NextResponse.json({ promoCode }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Error creating promo code:", error)
    return NextResponse.json({ error: "Failed to create promo code" }, { status: 500 })
  }
}

