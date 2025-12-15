import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const carSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.enum(["ROAD", "OFFROAD"]).optional(),
  type: z.string().min(1).optional(),
  unitCost: z.number().positive().nullable().optional(),
  basePricePerDay: z.number().positive().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  imageUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params
    const body = await request.json()
    const validatedData = carSchema.parse(body)

    const car = await prisma.car.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({ car })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating car:", error)
    return NextResponse.json(
      { error: "Failed to update car" },
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
    await prisma.car.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Car deleted successfully" })
  } catch (error) {
    console.error("Error deleting car:", error)
    return NextResponse.json(
      { error: "Failed to delete car" },
      { status: 500 }
    )
  }
}

