import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { getReminderOffsets, setReminderOffsets } from "@/lib/reminders/config"

function isValidOffsets(offsets: unknown): offsets is number[] {
  return (
    Array.isArray(offsets) &&
    offsets.every((n) => Number.isFinite(n) && n >= 0 && n <= 365)
  )
}

export async function GET() {
  const offsets = await getReminderOffsets()
  return NextResponse.json({ offsets })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { offsets } = body
    if (!isValidOffsets(offsets)) {
      return NextResponse.json(
        { error: "Invalid offsets; provide an array of numbers (days before event)." },
        { status: 400 }
      )
    }

    // Normalize: unique, sorted desc for readability
    const normalized = Array.from(new Set(offsets.map((n: number) => Math.round(n)))).sort(
      (a, b) => b - a
    )

    await setReminderOffsets(normalized)
    return NextResponse.json({ offsets: normalized })
  } catch (error) {
    console.error("Failed to update reminder config:", error)
    return NextResponse.json({ error: "Failed to update reminder config" }, { status: 500 })
  }
}


