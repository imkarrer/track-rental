import "server-only"

interface Booking {
  id: string
  eventDate: Date
  endDate: Date | null
  startTime: string
  endTime: string
  eventAddress: string
  eventCity: string
  eventState: string
  eventZip: string
  total: any // Decimal from Prisma
  track: {
    name: string
  }
  bookingCars: Array<{
    quantity: number
    car: {
      name: string
    }
  }>
  user: {
    email: string
    firstName: string | null
    lastName: string | null
  }
}

interface CustomerInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  billingAddress: string
  billingCity: string
  billingState: string
  billingZip: string
}

export async function sendBookingConfirmationEmail({
  booking,
  customerInfo,
}: {
  booking: Booking
  customerInfo: CustomerInfo
}) {
  // For local development, use MailHog (SMTP on localhost:1025)
  // For production, use a real email service like Resend or SendGrid
  
  const emailService = process.env.EMAIL_SERVICE || "mailhog"
  
  if (emailService === "mailhog" || process.env.NODE_ENV === "development") {
    // Use MailHog for local development
    const emailData = {
      from: process.env.EMAIL_FROM || "noreply@trackrental.com",
      to: customerInfo.email,
      subject: `Booking Confirmation - ${booking.track.name}`,
      text: generateEmailText(booking, customerInfo),
      html: generateEmailHTML(booking, customerInfo),
    }

    // Send via MailHog SMTP (localhost:1025)
    const nodemailer = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: "localhost",
      port: 1025,
      secure: false,
    })

    await transporter.sendMail(emailData)
    return
  }

  // For production, integrate with Resend, SendGrid, or similar
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: process.env.EMAIL_FROM,
  //   to: customerInfo.email,
  //   subject: `Booking Confirmation - ${booking.track.name}`,
  //   html: generateEmailHTML(booking, customerInfo),
  // })
}

function generateEmailText(booking: Booking, customerInfo: CustomerInfo): string {
  const total = Number(booking.total).toFixed(2)
  const eventDate = new Date(booking.eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return `
Booking Confirmation

Thank you for your booking, ${customerInfo.firstName}!

Booking Details:
- Track: ${booking.track.name}
- Date: ${eventDate}
- Time: ${booking.startTime} - ${booking.endTime}
- Location: ${booking.eventAddress}, ${booking.eventCity}, ${booking.eventState} ${booking.eventZip}

Cars Included:
${booking.bookingCars.map((bc) => `- ${bc.car.name} (x${bc.quantity})`).join("\n")}

Total Amount: $${total}

Your booking has been confirmed. We'll contact you soon with setup details.

Thank you!
RC Track Rental Team
  `.trim()
}

function generateEmailHTML(booking: Booking, customerInfo: CustomerInfo): string {
  const total = Number(booking.total).toFixed(2)
  const eventDate = new Date(booking.eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .total { font-size: 24px; font-weight: bold; color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Confirmed!</h1>
    </div>
    <div class="content">
      <p>Thank you for your booking, ${customerInfo.firstName}!</p>
      
      <div class="details">
        <h2>Booking Details</h2>
        <p><strong>Track:</strong> ${booking.track.name}</p>
        <p><strong>Date:</strong> ${eventDate}</p>
        <p><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
        <p><strong>Location:</strong> ${booking.eventAddress}, ${booking.eventCity}, ${booking.eventState} ${booking.eventZip}</p>
      </div>

      <div class="details">
        <h2>Cars Included</h2>
        <ul>
          ${booking.bookingCars.map((bc) => `<li>${bc.car.name} (x${bc.quantity})</li>`).join("")}
        </ul>
      </div>

      <div class="details">
        <p class="total">Total Amount: $${total}</p>
      </div>

      <p>Your booking has been confirmed. We'll contact you soon with setup details.</p>
      
      <p>Thank you!<br>RC Track Rental Team</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

