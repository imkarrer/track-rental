import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") as "ROAD" | "OFFROAD" | null
    const isActive = searchParams.get("active") !== "false"
    const includeTestOnly = searchParams.get("includeTestOnly") === "true"

    // Check if user is admin - admins can see testOnly tracks
    const session = await getServerSession(authOptions)
    const isAdmin = session?.user?.role === "ADMIN"

    // Build where clause - hide testOnly tracks unless user is admin OR explicitly requesting via includeTestOnly
    const testOnlyFilter = (isAdmin && includeTestOnly) ? undefined : false

    const tracksRaw = await prisma.track.findMany({
      where: {
        isActive: isActive ? true : undefined,
        category: category || undefined,
        testOnly: testOnlyFilter,
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
    const tracks = tracksRaw.map((track) => ({
      ...track,
      basePrice: Number(track.basePrice),
      unitCost: track.unitCost ? Number(track.unitCost) : null,
      length: Number(track.length),
      width: Number(track.width),
      minSpaceLength: Number(track.minSpaceLength),
      minSpaceWidth: Number(track.minSpaceWidth),
    }))

    // Debug: Log category values
    if (tracks.length > 0) {
      console.log("Track categories:", tracks.map(t => ({ id: t.id, name: t.name, category: t.category, categoryType: typeof t.category })))
    }

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("Error fetching tracks:", error)
    return NextResponse.json(
      { error: "Failed to fetch tracks" },
      { status: 500 }
    )
  }
}

