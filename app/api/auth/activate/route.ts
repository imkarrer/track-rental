import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const schema = z.object({
  token: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = schema.parse(body)

    const user = await prisma.user.findFirst({
      where: {
        activationToken: token,
        activationExpires: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        activationToken: null,
        activationExpires: null,
      },
    })

    return NextResponse.json({ activated: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Activation error:", error)
    return NextResponse.json({ error: "Activation failed" }, { status: 500 })
  }
}


