import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const chargerSchema = z.object({
  name: z.string().min(1).optional(),
  batteryType: z.enum(["NIMH", "LIION", "ALKALINE", "LITHIUM_DISPOSABLE"]).optional(),
  capacity: z.number().int().positive().optional(),
  purchaseDate: z.string().transform((str) => new Date(str)).optional(),
  purchaseCost: z.number().positive().optional(),
  expectedLifespanYears: z.number().int().positive().nullable().optional(),
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
    const charger = await prisma.charger.findUnique({
      where: { id },
    })

    if (!charger) {
      return NextResponse.json(
        { error: "Charger not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ charger })
  } catch (error) {
    console.error("Error fetching charger:", error)
    return NextResponse.json(
      { error: "Failed to fetch charger" },
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
    
    // Handle purchaseDate transformation if provided
    if (body.purchaseDate) {
      body.purchaseDate = new Date(body.purchaseDate)
    }
    
    const validatedData = chargerSchema.parse(body)

    const charger = await prisma.charger.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({ charger })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating charger:", error)
    return NextResponse.json(
      { error: "Failed to update charger" },
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
    await prisma.charger.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Charger deleted successfully" })
  } catch (error) {
    console.error("Error deleting charger:", error)
    return NextResponse.json(
      { error: "Failed to delete charger" },
      { status: 500 }
    )
  }
}

