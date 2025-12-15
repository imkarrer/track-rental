import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") as "ROAD" | "OFFROAD" | null
    const type = searchParams.get("type") || ""
    const isActive = searchParams.get("active") !== "false"

    const carsRaw = await prisma.car.findMany({
      where: {
        isActive: isActive ? true : undefined,
        category: category || undefined,
        type: type ? { contains: type, mode: "insensitive" } : undefined,
        OR: search
          ? [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Convert Decimal fields to numbers for JSON serialization
    const cars = carsRaw.map((car) => ({
      ...car,
      basePricePerDay: Number(car.basePricePerDay),
      unitCost: car.unitCost ? Number(car.unitCost) : null,
    }))

    return NextResponse.json({ cars })
  } catch (error) {
    console.error("Error fetching cars:", error)
    return NextResponse.json(
      { error: "Failed to fetch cars" },
      { status: 500 }
    )
  }
}

