import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { sendEmail } from "@/lib/email/send"
import { sendSms, isTwilioConfigured } from "@/lib/sms/twilio"
import { formatDateWithWeekdayUTC, toUTCDate } from "@/lib/date/format"
import { getReminderOffsets } from "@/lib/reminders/config"

function addDaysUTC(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

async function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (user?.role === "ADMIN") return true
  }

  return false
}

async function hasSentReminder(bookingId: string, channel: "email" | "sms", subject: string) {
  const existing = await prisma.communicationLog.findFirst({
    where: {
      bookingId,
      channel,
      subject,
      status: "SENT",
    },
  })
  return !!existing
}

function buildEmailBody(trackName: string, eventLabel: string, daysOut: number) {
  const whenText = daysOut === 1 ? "tomorrow" : `in ${daysOut} days`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #2563EB;">Reminder: Your ${trackName} booking is coming up</h2>
      <p>Your event is scheduled for <strong>${eventLabel}</strong> (${whenText}).</p>
      <ul>
        <li>Please confirm access to the event location.</li>
        <li>Ensure the space is ready for setup.</li>
        <li>Have your point-of-contact available on-site.</li>
      </ul>
      <p>If you need any changes, reply to this email and we’ll help.</p>
      <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">
        This reminder was sent automatically. If you no longer wish to receive emails, update your preferences in your booking.
      </p>
    </div>
  `
}

function buildSmsBody(trackName: string, eventLabel: string, daysOut: number) {
  const whenText = daysOut === 1 ? "tomorrow" : `in ${daysOut} days`
  return `Reminder: ${trackName} booking ${whenText} on ${eventLabel}. Reply STOP to opt out.`
}

export async function GET() {
  try {
    const offsets = await getReminderOffsets()
    const today = toUTCDate(new Date())
    if (!today) throw new Error("Unable to parse current date")

    const targets = offsets.map((d) => addDaysUTC(today, d))

    const [oneDay, threeDay] = await Promise.all(
      targets.map((date) =>
        prisma.booking.count({
          where: {
            eventDate: date,
            status: { in: ["CONFIRMED", "PENDING"] },
          },
        })
      )
    )

    return NextResponse.json({
      upcomingIn1Day: oneDay ?? 0,
      upcomingIn3Days: threeDay ?? 0,
      targetDates: targets.map((d) => d.toISOString().split("T")[0]),
    })
  } catch (error) {
    console.error("Error fetching reminder stats:", error)
    return NextResponse.json({ error: "Failed to fetch reminder stats" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorized = await isAuthorized(request)
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startTime = Date.now()
    const offsets = await getReminderOffsets()
    const today = toUTCDate(new Date())
    if (!today) throw new Error("Unable to parse current date")

    const targets = offsets.map((d) => addDaysUTC(today, d))

    const bookings = await prisma.booking.findMany({
      where: {
        eventDate: { in: targets },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      include: {
        user: true,
        track: true,
      },
    })

    let emailsSent = 0
    let smsSent = 0
    const skipped: Array<{ bookingId: string; reason: string }> = []
    const errors: Array<{ bookingId: string; error: string }> = []

    for (const booking of bookings) {
      const eventDate = toUTCDate(booking.eventDate)
      if (!eventDate) continue
      const daysOut = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const eventLabel = formatDateWithWeekdayUTC(eventDate)
      const emailSubject = `Reminder (${daysOut} day${daysOut === 1 ? "" : "s"}): ${booking.track.name}`
      const emailBody = buildEmailBody(booking.track.name, eventLabel, daysOut)
      const smsBody = buildSmsBody(booking.track.name, eventLabel, daysOut)

      // Email reminder
      if (!booking.emailOptOut && booking.user?.email) {
        const alreadySent = await hasSentReminder(booking.id, "email", emailSubject)
        if (!alreadySent) {
          try {
            await sendEmail({
              to: booking.user.email,
              subject: emailSubject,
              html: emailBody,
            })
            emailsSent++
            await prisma.communicationLog.create({
              data: {
                bookingId: booking.id,
                channel: "email",
                direction: "outbound",
                toEmail: booking.user.email,
                subject: emailSubject,
                body: emailBody,
                status: "SENT",
              },
            })
          } catch (err: any) {
            errors.push({ bookingId: booking.id, error: err?.message || "Email failed" })
            await prisma.communicationLog.create({
              data: {
                bookingId: booking.id,
                channel: "email",
                direction: "outbound",
                toEmail: booking.user.email,
                subject: emailSubject,
                body: emailBody,
                status: "FAILED",
                providerId: err?.message,
              },
            })
          }
        } else {
          skipped.push({ bookingId: booking.id, reason: "email already sent" })
        }
      } else {
        skipped.push({ bookingId: booking.id, reason: "email opt-out or missing" })
      }

      // SMS reminder
      if (booking.smsOptIn && booking.phone) {
        const smsSubject = `SMS ${emailSubject}`
        const alreadySentSms = await hasSentReminder(booking.id, "sms", smsSubject)
        if (!alreadySentSms) {
          if (!isTwilioConfigured) {
            skipped.push({ bookingId: booking.id, reason: "twilio not configured" })
          } else {
            try {
              const res = await sendSms(booking.phone, smsBody)
              smsSent++
              await prisma.communicationLog.create({
                data: {
                  bookingId: booking.id,
                  channel: "sms",
                  direction: "outbound",
                  toPhone: booking.phone,
                  subject: smsSubject,
                  body: smsBody,
                  status: "SENT",
                  providerId: (res as any)?.sid,
                },
              })
            } catch (err: any) {
              errors.push({ bookingId: booking.id, error: err?.message || "SMS failed" })
              await prisma.communicationLog.create({
                data: {
                  bookingId: booking.id,
                  channel: "sms",
                  direction: "outbound",
                  toPhone: booking.phone,
                  subject: smsSubject,
                  body: smsBody,
                  status: "FAILED",
                  providerId: err?.message,
                },
              })
            }
          }
        } else {
          skipped.push({ bookingId: booking.id, reason: "sms already sent" })
        }
      } else {
        skipped.push({ bookingId: booking.id, reason: "sms opt-in missing or phone missing" })
      }
    }

    const executionTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      bookingsProcessed: bookings.length,
      emailsSent,
      smsSent,
      skipped: skipped.length,
      errors: errors.length,
      details: { skipped, errors },
      executionTimeMs: executionTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error sending reminders:", error)
    return NextResponse.json(
      {
        error: "Failed to send reminders",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

