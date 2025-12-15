import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const chargerSchema = z.object({
  name: z.string().min(1),
  batteryType: z.enum(["NIMH", "LIION", "ALKALINE", "LITHIUM_DISPOSABLE"]),
  capacity: z.number().int().positive(),
  purchaseDate: z.string().transform((str) => new Date(str)),
  purchaseCost: z.number().positive(),
  expectedLifespanYears: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Check if the model exists (Prisma Client might not be regenerated)
    if (!prisma.charger) {
      return NextResponse.json(
        {
          error: "Charger model not found. Please run: npm run db:generate && npm run db:push",
          hint: "The database table needs to be created. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }

    const chargers = await prisma.charger.findMany({
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ chargers })
  } catch (error) {
    // Check for Prisma model/table not found error
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (
      errorMessage.includes("charger") ||
      errorMessage.includes("chargers") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Cannot read properties of undefined")
    ) {
      return NextResponse.json(
        {
          error: "Database table not found. Please run: npm run db:generate && npm run db:push",
          hint: "The Charger table needs to be created in the database. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }
    
    console.error("Error fetching chargers:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch chargers",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    // Check if the model exists (Prisma Client might not be regenerated)
    if (!prisma.charger) {
      return NextResponse.json(
        {
          error: "Charger model not found. Please run: npm run db:generate && npm run db:push",
          hint: "The database table needs to be created. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const validatedData = chargerSchema.parse(body)

    const charger = await prisma.charger.create({
      data: validatedData,
    })

    return NextResponse.json({ charger }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    
    // Check for Prisma model/table not found error
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (
      errorMessage.includes("charger") ||
      errorMessage.includes("chargers") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Cannot read properties of undefined")
    ) {
      return NextResponse.json(
        {
          error: "Database table not found. Please run: npm run db:generate && npm run db:push",
          hint: "The Charger table needs to be created in the database. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }
    
    console.error("Error creating charger:", error)
    return NextResponse.json(
      {
        error: "Failed to create charger",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

