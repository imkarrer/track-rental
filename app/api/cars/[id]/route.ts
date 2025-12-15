import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const car = await prisma.car.findUnique({
      where: { id },
    })

    if (!car) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 })
    }

    return NextResponse.json({ car })
  } catch (error) {
    console.error("Error fetching car:", error)
    return NextResponse.json(
      { error: "Failed to fetch car" },
      { status: 500 }
    )
  }
}

