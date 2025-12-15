import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || "Unknown"
}

const dayMultiplierSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  multiplier: z.number().positive(),
  dayName: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Check if the model exists
    if (!prisma.dayMultiplier) {
      return NextResponse.json(
        {
          error: "DayMultiplier model not found. Please run: npm run db:generate && npm run db:push",
        },
        { status: 503 }
      )
    }

    const multipliers = await prisma.dayMultiplier.findMany({
      orderBy: {
        dayOfWeek: "asc",
      },
    })

    // If no multipliers exist, return defaults
    if (multipliers.length === 0) {
      const defaults = [
        { dayOfWeek: 0, multiplier: 1.3, dayName: "Sunday" },
        { dayOfWeek: 1, multiplier: 1.0, dayName: "Monday" },
        { dayOfWeek: 2, multiplier: 1.0, dayName: "Tuesday" },
        { dayOfWeek: 3, multiplier: 1.0, dayName: "Wednesday" },
        { dayOfWeek: 4, multiplier: 1.0, dayName: "Thursday" },
        { dayOfWeek: 5, multiplier: 1.2, dayName: "Friday" },
        { dayOfWeek: 6, multiplier: 1.5, dayName: "Saturday" },
      ]
      return NextResponse.json({ multipliers: defaults })
    }

    // Convert Decimal to number for JSON serialization
    return NextResponse.json({
      multipliers: multipliers.map((m) => ({
        dayOfWeek: m.dayOfWeek,
        multiplier: Number(m.multiplier),
        dayName: m.dayName || getDayName(m.dayOfWeek), // Use dayName field, fallback to calculated name
      })),
    })
  } catch (error) {
    console.error("Error fetching day multipliers:", error)
    return NextResponse.json(
      { error: "Failed to fetch day multipliers" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()

    // Check if the model exists
    if (!prisma.dayMultiplier) {
      return NextResponse.json(
        {
          error: "DayMultiplier model not found. Please run: npm run db:generate && npm run db:push",
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { multipliers } = body

    if (!Array.isArray(multipliers)) {
      return NextResponse.json(
        { error: "multipliers must be an array" },
        { status: 400 }
      )
    }

    // Validate all multipliers - coerce strings to numbers
    const validatedMultipliers = multipliers.map((m: any) =>
      dayMultiplierSchema.parse({
        dayOfWeek: typeof m.dayOfWeek === 'string' ? parseInt(m.dayOfWeek, 10) : m.dayOfWeek,
        multiplier: typeof m.multiplier === 'string' ? parseFloat(m.multiplier) : m.multiplier,
        dayName: m.dayName,
      })
    )

    // Upsert each multiplier
    const results = await Promise.all(
      validatedMultipliers.map((m) =>
        prisma.dayMultiplier.upsert({
          where: { dayOfWeek: m.dayOfWeek },
          update: {
            multiplier: m.multiplier,
            dayName: m.dayName,
          },
          create: {
            dayOfWeek: m.dayOfWeek,
            multiplier: m.multiplier,
            dayName: m.dayName,
          },
        })
      )
    )

    return NextResponse.json({ multipliers: results })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating day multipliers:", error)
    return NextResponse.json(
      { error: "Failed to update day multipliers" },
      { status: 500 }
    )
  }
}

