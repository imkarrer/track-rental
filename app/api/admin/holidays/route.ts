import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { getStandardHolidaysForYear } from "@/lib/pricing/holidays"

const holidaySchema = z.object({
  name: z.string().min(1),
  date: z.string().transform((str) => new Date(str)),
  isRecurring: z.boolean().default(false),
  year: z.number().int().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : new Date().getFullYear()

    const holidays = await prisma.holiday.findMany({
      where: {
        OR: [
          { isRecurring: true },
          { year: year },
          { year: null },
        ],
      },
      orderBy: { date: "asc" },
    })

    return NextResponse.json({ holidays })
  } catch (error) {
    console.error("Error fetching holidays:", error)
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validatedData = holidaySchema.parse(body)

    const holiday = await prisma.holiday.create({
      data: validatedData,
    })

    return NextResponse.json({ holiday }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating holiday:", error)
    return NextResponse.json(
      { error: "Failed to create holiday" },
      { status: 500 }
    )
  }
}

/**
 * Initialize standard US bank holidays for the current year and next year
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const action = body.action

    if (action === "initialize") {
      const currentYear = new Date().getFullYear()
      const nextYear = currentYear + 1

      // Get standard holidays for both years
      const currentYearHolidays = getStandardHolidaysForYear(currentYear)
      const nextYearHolidays = getStandardHolidaysForYear(nextYear)

      // Create holidays (skip if they already exist)
      // Ensure dates are normalized correctly for PostgreSQL DATE storage
      // Create dates at noon first to avoid DST issues, then set to midnight
      const normalizeDateForDB = (date: Date): Date => {
        // Get the calendar date components (using local time methods)
        const year = date.getFullYear()
        const month = date.getMonth()
        const day = date.getDate()
        
        // Create at noon first to avoid DST boundary issues
        const normalized = new Date(year, month, day, 12, 0, 0)
        // Set to midnight - this ensures the date represents the correct calendar date
        normalized.setHours(0, 0, 0, 0)
        return normalized
      }

      const holidaysToCreate = [
        ...currentYearHolidays.map((h) => ({
          name: h.name,
          date: normalizeDateForDB(h.date),
          isRecurring: true,
          isActive: true,
        })),
        ...nextYearHolidays.map((h) => ({
          name: h.name,
          date: normalizeDateForDB(h.date),
          isRecurring: true,
          isActive: true,
        })),
      ]

      // Use upsert to avoid duplicates
      const results = await Promise.all(
        holidaysToCreate.map((holiday) =>
          prisma.holiday.upsert({
            where: {
              date: holiday.date,
            },
            update: {
              isActive: holiday.isActive,
            },
            create: holiday,
          })
        )
      )

      return NextResponse.json({
        message: "Holidays initialized",
        holidays: results,
      })
    }

    if (action === "deleteAll") {
      const deleted = await prisma.holiday.deleteMany({})
      return NextResponse.json({
        message: `Deleted ${deleted.count} holidays`,
        count: deleted.count,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error initializing holidays:", error)
    return NextResponse.json(
      { error: "Failed to initialize holidays" },
      { status: 500 }
    )
  }
}

