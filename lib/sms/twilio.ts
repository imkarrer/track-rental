const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_FROM_NUMBER
const mockMode =
  process.env.TWILIO_MOCK === "1" ||
  process.env.TWILIO_MOCK === "true" ||
  (!accountSid || !authToken || !fromNumber)

export const isTwilioConfigured = !!accountSid && !!authToken && !!fromNumber && !mockMode

async function getClient() {
  if (!isTwilioConfigured) return null
  try {
    // Use eval(require) to avoid bundler static resolution when twilio is not installed
    const req = Function("return require")()
    const twilio = req("twilio")
    const twilioFactory: any = twilio.default || twilio
    return twilioFactory(accountSid, authToken)
  } catch (err) {
    console.warn("Twilio SDK not installed; SMS will be skipped/logged", err)
    return null
  }
}

export async function sendSms(to: string, body: string) {
  if (mockMode) {
    console.log("[TWILIO MOCK] SMS to", to, "body:", body)
    return { sid: "mock", to, body, mock: true }
  }
  if (!isTwilioConfigured || !fromNumber) {
    throw new Error("Twilio not configured")
  }
  const client = await getClient()
  if (!client) {
    throw new Error("Twilio SDK not available")
  }
  const msg = await client.messages.create({
    to,
    from: fromNumber,
    body,
  })
  return msg
}

