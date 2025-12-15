import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const carSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.enum(["ROAD", "OFFROAD"]).default("ROAD"),
  type: z.string().min(1),
  unitCost: z.number().positive().nullable().optional(),
  basePricePerDay: z.number().positive(),
  stockQuantity: z.number().int().min(0),
  imageUrls: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validatedData = carSchema.parse(body)

    const car = await prisma.car.create({
      data: validatedData,
    })

    return NextResponse.json({ car }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating car:", error)
    return NextResponse.json(
      { error: "Failed to create car" },
      { status: 500 }
    )
  }
}

