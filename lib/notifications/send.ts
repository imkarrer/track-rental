import { sendBookingConfirmationEmail } from "@/lib/email/booking"
import { isTwilioConfigured, sendSms } from "@/lib/sms/twilio"
import { prisma } from "@/lib/db/prisma"

type BookingLike = {
  id: string
  eventDate: Date
  phone?: string | null
  smsOptIn?: boolean | null
  emailOptOut?: boolean | null
  track: { name: string }
  user: { firstName?: string | null; lastName?: string | null; email: string }
}

type CustomerInfoLike = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  billingAddress?: string
  billingCity?: string
  billingState?: string
  billingZip?: string
}

export async function sendBookingNotifications(opts: {
  booking: BookingLike
  customerInfo?: CustomerInfoLike
}) {
  const { booking, customerInfo } = opts
  const dateStr = booking.eventDate.toISOString().slice(0, 10)
  const emailSubject = `Booking Confirmation - ${booking.track.name}`

  // Email
  if (!booking.emailOptOut && booking.user?.email) {
    try {
      await sendBookingConfirmationEmail({
        booking: booking as any,
        customerInfo: {
          firstName: customerInfo?.firstName ?? booking.user.firstName ?? "",
          lastName: customerInfo?.lastName ?? booking.user.lastName ?? "",
          email: customerInfo?.email ?? booking.user.email,
          phone: customerInfo?.phone ?? booking.phone ?? "",
          billingAddress: customerInfo?.billingAddress ?? "",
          billingCity: customerInfo?.billingCity ?? "",
          billingState: customerInfo?.billingState ?? "",
          billingZip: customerInfo?.billingZip ?? "",
        },
      })
      await prisma.communicationLog.create({
        data: {
          bookingId: booking.id,
          channel: "email",
          direction: "outbound",
          toEmail: booking.user.email,
          subject: emailSubject,
          body: `Confirmation sent for ${booking.track.name} on ${dateStr}`,
          status: "SENT",
        },
      })
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError)
      await prisma.communicationLog.create({
        data: {
          bookingId: booking.id,
          channel: "email",
          direction: "outbound",
          toEmail: booking.user.email,
          subject: emailSubject,
          body: `Confirmation failed for ${booking.track.name} on ${dateStr}`,
          status: "FAILED",
          providerId: emailError instanceof Error ? emailError.message : String(emailError),
        },
      })
    }
  }

  // SMS
  if (booking.smsOptIn && booking.phone) {
    if (!isTwilioConfigured) {
      console.warn("Twilio not configured or in mock; SMS may be skipped/logged")
    }
    try {
      const dateStr = booking.eventDate.toISOString().slice(0, 10)
      const smsBody = `Your booking is confirmed for ${booking.track.name} on ${dateStr}. Reply STOP to opt out.`
      await sendSms(booking.phone, smsBody)
      await prisma.communicationLog.create({
        data: {
          bookingId: booking.id,
          channel: "sms",
          direction: "outbound",
          toPhone: booking.phone,
          subject: `SMS confirmation: ${booking.track.name}`,
          body: smsBody,
          status: "SENT",
        },
      })
    } catch (smsError) {
      console.error("Error sending SMS:", smsError)
      await prisma.communicationLog.create({
        data: {
          bookingId: booking.id,
          channel: "sms",
          direction: "outbound",
          toPhone: booking.phone,
          subject: `SMS confirmation: ${booking.track.name}`,
          body: `Failed to send SMS for ${booking.track.name} on ${dateStr}`,
          status: "FAILED",
          providerId: smsError instanceof Error ? smsError.message : String(smsError),
        },
      })
    }
  }
}

