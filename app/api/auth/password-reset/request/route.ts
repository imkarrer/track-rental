import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { normalizeEmail } from "@/lib/auth/email-normalize"
import { sendEmail } from "@/lib/email/send"

const schema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = schema.parse(body)
    const norm = normalizeEmail(email)

    const user = await prisma.user.findUnique({
      where: { emailCanonical: norm.canonical },
    })

    if (user) {
      const resetToken = crypto.randomUUID()
      const resetExpires = new Date(Date.now() + 1000 * 60 * 30)
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetExpires },
      })
      try {
        await sendEmail({
          to: user.email,
          subject: "Password reset",
          html: `<p>Reset your password: <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/reset?token=${resetToken}">Reset</a></p>`,
        })
      } catch (err) {
        console.error("Failed to send reset email", err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("Reset request error:", error)
    return NextResponse.json({ error: "Failed to process reset request" }, { status: 500 })
  }
}


