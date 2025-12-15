import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { hashPassword } from "@/lib/auth/helpers"

const schema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = schema.parse(body)

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetExpires: null,
      },
    })

    return NextResponse.json({ reset: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("Reset confirm error:", error)
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
  }
}


