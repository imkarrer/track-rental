import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const trackRaw = await prisma.track.findUnique({
      where: { id },
    })

    if (!trackRaw) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 })
    }

    // If track is testOnly, verify user is admin
    if (trackRaw.testOnly) {
      const session = await getServerSession(authOptions)
      const isAdmin = session?.user?.role === "ADMIN"
      
      if (!isAdmin) {
        return NextResponse.json({ error: "Track not found" }, { status: 404 })
      }
    }

    // Convert Decimal fields to numbers for JSON serialization
    const track = {
      ...trackRaw,
      basePrice: Number(trackRaw.basePrice),
      unitCost: trackRaw.unitCost ? Number(trackRaw.unitCost) : null,
      length: Number(trackRaw.length),
      width: Number(trackRaw.width),
      minSpaceLength: Number(trackRaw.minSpaceLength),
      minSpaceWidth: Number(trackRaw.minSpaceWidth),
    }

    return NextResponse.json({ track })
  } catch (error) {
    console.error("Error fetching track:", error)
    return NextResponse.json(
      { error: "Failed to fetch track" },
      { status: 500 }
    )
  }
}

