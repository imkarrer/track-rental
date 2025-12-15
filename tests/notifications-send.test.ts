import { describe, it, expect, beforeEach, vi } from "vitest"
import { sendBookingNotifications } from "@/lib/notifications/send"

const mockPrisma = vi.hoisted(() => ({
  communicationLog: { create: vi.fn() },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/email/booking", () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/sms/twilio", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
  isTwilioConfigured: true,
}))

describe("sendBookingNotifications", () => {
  beforeEach(() => {
    mockPrisma.communicationLog.create.mockReset()
  })

  it("logs email and sms communications when sent", async () => {
    const booking = {
      id: "booking-1",
      eventDate: new Date("2025-01-01T10:00:00Z"),
      phone: "+15555550123",
      smsOptIn: true,
      emailOptOut: false,
      track: { name: "Pro Track" },
      user: { firstName: "Pat", lastName: "Smith", email: "pat@example.com" },
    }

    await sendBookingNotifications({ booking })

    const calls = mockPrisma.communicationLog.create.mock.calls
    expect(calls.length).toBe(2)

    const emailLog = calls.find((c) => c[0].data.channel === "email")?.[0].data
    const smsLog = calls.find((c) => c[0].data.channel === "sms")?.[0].data

    expect(emailLog?.status).toBe("SENT")
    expect(emailLog?.toEmail).toBe("pat@example.com")
    expect(emailLog?.subject).toContain("Booking Confirmation")

    expect(smsLog?.status).toBe("SENT")
    expect(smsLog?.toPhone).toBe("+15555550123")
    expect(smsLog?.subject).toContain("SMS confirmation")
  })
})


