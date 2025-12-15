import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const trackSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.enum(["ROAD", "OFFROAD"]).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  minSpaceLength: z.number().positive().optional(),
  minSpaceWidth: z.number().positive().optional(),
  unitCost: z.number().positive().nullable().optional(),
  includedCarIds: z.array(z.string().uuid()).length(2, "Must select exactly 2 cars").optional(),
  basePrice: z.number().positive().optional(),
  setupTimeMinutes: z.number().int().positive().optional(),
  imageUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  testOnly: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params
    const body = await request.json()
    const validatedData = trackSchema.parse(body)

    // Get current track to check category if it's being updated
    const currentTrack = await prisma.track.findUnique({
      where: { id },
      select: { category: true },
    })

    if (!currentTrack) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404 }
      )
    }

    // Use the category from the update or the current track
    const trackCategory = validatedData.category || currentTrack.category

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
        (car) => car.category !== trackCategory
      )
      if (mismatchedCars.length > 0) {
        return NextResponse.json(
          {
            error: `Selected cars must match the track category. Found ${mismatchedCars.length} car(s) with category ${mismatchedCars[0].category} but track is ${trackCategory}`,
          },
          { status: 400 }
        )
      }
    }

    const track = await prisma.track.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({ track })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating track:", error)
    return NextResponse.json(
      { error: "Failed to update track" },
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
    await prisma.track.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Track deleted successfully" })
  } catch (error) {
    console.error("Error deleting track:", error)
    return NextResponse.json(
      { error: "Failed to delete track" },
      { status: 500 }
    )
  }
}

