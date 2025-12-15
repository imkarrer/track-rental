import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const batteryBatchSchema = z.object({
  name: z.string().min(1).optional(),
  batteryType: z.enum(["NIMH", "LIION", "ALKALINE", "LITHIUM_DISPOSABLE"]).optional(),
  usage: z.enum(["CAR", "TRANSMITTER"]).optional(),
  quantity: z.number().int().positive().optional(),
  purchaseDate: z.string().transform((str) => new Date(str)).optional(),
  purchaseCost: z.number().positive().optional(),
  expectedCycles: z.number().int().positive().optional().nullable(),
  expectedRuntimeRoad: z.number().positive().nullable().optional(),
  expectedRuntimeOffroad: z.number().positive().nullable().optional(),
  chargerCost: z.number().min(0).nullable().optional(),
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
    const battery = await prisma.batteryBatch.findUnique({
      where: { id },
    })

    if (!battery) {
      return NextResponse.json(
        { error: "Battery batch not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ battery })
  } catch (error) {
    console.error("Error fetching battery batch:", error)
    return NextResponse.json(
      { error: "Failed to fetch battery batch" },
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
    
    const validatedData = batteryBatchSchema.parse(body)

    const battery = await prisma.batteryBatch.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({ battery })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating battery batch:", error)
    return NextResponse.json(
      { error: "Failed to update battery batch" },
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
    await prisma.batteryBatch.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Battery batch deleted successfully" })
  } catch (error) {
    console.error("Error deleting battery batch:", error)
    return NextResponse.json(
      { error: "Failed to delete battery batch" },
      { status: 500 }
    )
  }
}

