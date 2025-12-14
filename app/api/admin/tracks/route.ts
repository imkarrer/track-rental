import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const trackSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.enum(["ROAD", "OFFROAD"]).default("ROAD"),
  length: z.number().positive(),
  width: z.number().positive(),
  minSpaceLength: z.number().positive(),
  minSpaceWidth: z.number().positive(),
  unitCost: z.number().positive().nullable().optional(),
  includedCarIds: z.array(z.string().uuid()).length(2, "Must select exactly 2 cars"),
  basePrice: z.number().positive(),
  setupTimeMinutes: z.number().int().positive(),
  imageUrls: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  testOnly: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    console.log("Creating track with data:", { category: body.category, ...body })
    const validatedData = trackSchema.parse(body)
    console.log("Validated data:", { category: validatedData.category, ...validatedData })

    // Validate that selected cars match the track category
    if (validatedData.includedCarIds && validatedData.includedCarIds.length > 0) {
      const cars = await prisma.car.findMany({
        where: {
          id: { in: validatedData.includedCarIds },
        },
        select: {
          id: true,
          category: true,
        },
      })

      // Check if all cars exist and match the track category
      if (cars.length !== validatedData.includedCarIds.length) {
        return NextResponse.json(
          { error: "One or more selected cars do not exist" },
          { status: 400 }
        )
      }

      const mismatchedCars = cars.filter(
        (car) => car.category !== validatedData.category
      )
      if (mismatchedCars.length > 0) {
        return NextResponse.json(
          {
            error: `Selected cars must match the track category. Found ${mismatchedCars.length} car(s) with category ${mismatchedCars[0].category} but track is ${validatedData.category}`,
          },
          { status: 400 }
        )
      }
    }

    const track = await prisma.track.create({
      data: validatedData,
    })
    console.log("Created track:", { id: track.id, category: track.category })

    return NextResponse.json({ track }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating track:", error)
    return NextResponse.json(
      { error: "Failed to create track" },
      { status: 500 }
    )
  }
}

