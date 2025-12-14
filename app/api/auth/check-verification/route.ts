import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { normalizeEmail } from "@/lib/auth/email-normalize"

const schema = z.object({
  email: z.string().email("Invalid email address"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = schema.parse(body)

    const norm = normalizeEmail(email)

    const user = await prisma.user.findUnique({
      where: { emailCanonical: norm.canonical },
      select: {
        emailVerified: true,
      },
    })

    // Don't reveal if user exists (security)
    if (!user) {
      return NextResponse.json({ verified: false })
    }

    return NextResponse.json({ 
      verified: !!user.emailVerified 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: error.errors[0].message 
      }, { status: 400 })
    }

    console.error("Check verification error:", error)
    return NextResponse.json({ 
      verified: false 
    })
  }
}

