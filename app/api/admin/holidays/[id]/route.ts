import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const holidayUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.string().transform((str) => new Date(str)).optional(),
  isRecurring: z.boolean().optional(),
  year: z.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params
    const holiday = await prisma.holiday.findUnique({
      where: { id },
    })

    if (!holiday) {
      return NextResponse.json(
        { error: "Holiday not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ holiday })
  } catch (error) {
    console.error("Error fetching holiday:", error)
    return NextResponse.json(
      { error: "Failed to fetch holiday" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params
    const body = await request.json()
    const validatedData = holidayUpdateSchema.parse(body)

    const holiday = await prisma.holiday.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({ holiday })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating holiday:", error)
    return NextResponse.json(
      { error: "Failed to update holiday" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params
    await prisma.holiday.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Holiday deleted" })
  } catch (error) {
    console.error("Error deleting holiday:", error)
    return NextResponse.json(
      { error: "Failed to delete holiday" },
      { status: 500 }
    )
  }
}

