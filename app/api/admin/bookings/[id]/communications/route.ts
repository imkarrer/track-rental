import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { sendEmail } from "@/lib/email/send"
import { sendSms, isTwilioConfigured } from "@/lib/sms/twilio"

const createSchema = z.object({
  channel: z.enum(["email", "sms"]),
  subject: z.string().optional(),
  body: z.string().min(1),
  toEmail: z.string().email().optional(),
  toPhone: z.string().optional(),
  overrideEmailOptOut: z.boolean().optional(),
  overrideSmsOptIn: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const logs = await prisma.communicationLog.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ communications: logs })
  } catch (error) {
    console.error("Error fetching communications:", error)
    return NextResponse.json(
      { error: "Failed to fetch communications" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const data = createSchema.parse(body)

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { user: true, track: true },
    })
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const channel = data.channel
    let status = "SENT"
    let providerId: string | undefined

    if (channel === "email") {
      const to = data.toEmail || booking.user.email
      if (!to) {
        return NextResponse.json({ error: "No email available" }, { status: 400 })
      }
      if (booking.emailOptOut && !data.overrideEmailOptOut) {
        return NextResponse.json({ error: "Email opt-out enabled" }, { status: 400 })
      }
      try {
        await sendEmail({
          to,
          subject: data.subject || `Booking Update: ${booking.track.name}`,
          html: `<p>${data.body}</p>`,
          text: data.body,
        })
      } catch (err: any) {
        status = "FAILED"
        providerId = err?.message
      }
    } else {
      const to = data.toPhone || booking.phone
      if (!to) {
        return NextResponse.json({ error: "No phone available" }, { status: 400 })
      }
      if ((!booking.smsOptIn && !data.overrideSmsOptIn) || !isTwilioConfigured) {
        status = "SKIPPED"
      } else {
        try {
          const res = await sendSms(to, data.body)
          providerId = (res as any)?.sid
        } catch (err: any) {
          status = "FAILED"
          providerId = err?.message
        }
      }
    }

    const log = await prisma.communicationLog.create({
      data: {
        bookingId: booking.id,
        channel,
        direction: "outbound",
        toEmail: channel === "email" ? data.toEmail || booking.user.email : null,
        toPhone: channel === "sms" ? (data.toPhone || booking.phone) : null,
        subject: data.subject,
        body: data.body,
        status,
        providerId,
      },
    })

    return NextResponse.json({ communication: log })
  } catch (error) {
    console.error("Error sending communication:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Failed to send communication" },
      { status: 500 }
    )
  }
}

