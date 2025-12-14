import "server-only"

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const emailService = process.env.EMAIL_SERVICE || "mailhog"
  
  if (emailService === "mailhog" || process.env.NODE_ENV === "development") {
    // Use MailHog for local development
    try {
      // Try localhost first, then fall back to 127.0.0.1 for WSL/Docker compatibility
      const mailhogHost = process.env.MAILHOG_HOST || "127.0.0.1"
      const mailhogPort = parseInt(process.env.MAILHOG_PORT || "1025")
      
      console.log(`[EMAIL] Attempting to connect to MailHog at ${mailhogHost}:${mailhogPort}`)
      
      // Use dynamic import like booking.ts does (works with Next.js webpack)
      const nodemailer = await import("nodemailer")
      const transporter = nodemailer.createTransport({
        host: mailhogHost,
        port: mailhogPort,
        secure: false,
        tls: {
          rejectUnauthorized: false
        }
      })

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || "noreply@trackrental.com",
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
        html,
      })
      
      console.log(`[EMAIL] ✅ Successfully sent to ${to}: ${subject}`)
      console.log(`[EMAIL] 📧 View at http://localhost:8025`)
      return
    } catch (error) {
      console.log(`[EMAIL] ❌ MailHog not available, logging email to console`)
      console.log(`[EMAIL] Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.log(`[EMAIL] To: ${to}, Subject: ${subject}`)
    }
  }

  // For now, just log the email - production email services need to be configured
  console.log(`[EMAIL] Would send to ${to}: ${subject}`)
  console.log(`[EMAIL] Configure EMAIL_SERVICE environment variable to use email in production`)
  console.log(`[EMAIL PREVIEW] HTML: ${html.substring(0, 200)}...`)
  
  // TODO: Install and configure email service
  // To use Resend: npm install resend, then set RESEND_API_KEY
  // To use SendGrid: npm install @sendgrid/mail, then set SENDGRID_API_KEY
}
