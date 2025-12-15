import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const batteryBatchSchema = z.object({
  name: z.string().min(1),
  batteryType: z.enum(["NIMH", "LIION", "ALKALINE", "LITHIUM_DISPOSABLE"]),
  usage: z.enum(["CAR", "TRANSMITTER"]),
  quantity: z.number().int().positive(),
  purchaseDate: z.string().transform((str) => new Date(str)),
  purchaseCost: z.number().positive(),
  expectedCycles: z.number().int().positive().nullable().optional(),
  expectedRuntimeRoad: z.number().positive().nullable().optional(),
  expectedRuntimeOffroad: z.number().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Check if the model exists (Prisma Client might not be regenerated)
    if (!prisma.batteryBatch) {
      return NextResponse.json(
        {
          error: "BatteryBatch model not found. Please run: npm run db:generate && npm run db:push",
          hint: "The database table needs to be created. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }

    const batteries = await prisma.batteryBatch.findMany({
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ batteries })
  } catch (error) {
    // Check for Prisma model/table not found error
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (
      errorMessage.includes("batteryBatch") ||
      errorMessage.includes("battery_batches") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Cannot read properties of undefined")
    ) {
      return NextResponse.json(
        {
          error: "Database table not found. Please run: npm run db:generate && npm run db:push",
          hint: "The BatteryBatch table needs to be created in the database. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }
    
    console.error("Error fetching batteries:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch batteries",
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
    if (!prisma.batteryBatch) {
      return NextResponse.json(
        {
          error: "BatteryBatch model not found. Please run: npm run db:generate && npm run db:push",
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
    const validatedData = batteryBatchSchema.parse(body)

    const battery = await prisma.batteryBatch.create({
      data: validatedData,
    })

    return NextResponse.json({ battery }, { status: 201 })
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
      errorMessage.includes("batteryBatch") ||
      errorMessage.includes("battery_batches") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Cannot read properties of undefined")
    ) {
      return NextResponse.json(
        {
          error: "Database table not found. Please run: npm run db:generate && npm run db:push",
          hint: "The BatteryBatch table needs to be created in the database. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }
    
    console.error("Error creating battery batch:", error)
    return NextResponse.json(
      {
        error: "Failed to create battery batch",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

