import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { normalizeEmail } from "@/lib/auth/email-normalize"
import { sendEmail } from "@/lib/email/send"

const schema = z.object({
  email: z.string().email("Invalid email address"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = schema.parse(body)

    const norm = normalizeEmail(email)

    // Find user
    const user = await prisma.user.findUnique({
      where: { emailCanonical: norm.canonical },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ 
        message: "If an account exists with this email, an activation link has been sent" 
      })
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({ 
        error: "This account is already activated. You can sign in." 
      }, { status: 400 })
    }

    // Generate new activation token
    const activationToken = crypto.randomUUID()
    const activationExpires = new Date(Date.now() + 1000 * 60 * 30) // 30 minutes

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        activationToken,
        activationExpires,
      },
    })

    // Send email
    try {
      const activationUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/activate?token=${activationToken}`

      await sendEmail({
        to: norm.original,
        subject: "Activate Your RC Track Rental Account",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏁 Activate Your Account</h1>
              </div>
              <div class="content">
                <p>Hi ${user.firstName},</p>
                <p>You requested a new activation link for your RC Track Rental account.</p>
                <p><strong>Click the button below to activate your account:</strong></p>
                <div style="text-align: center;">
                  <a href="${activationUrl}" class="button">Activate My Account</a>
                </div>
                <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
                <p style="font-size: 12px; word-break: break-all; background: #fff; padding: 10px; border-radius: 4px;">${activationUrl}</p>
                <p style="margin-top: 20px; font-size: 14px; color: #ef4444;">
                  ⏰ <strong>Important:</strong> This activation link expires in 30 minutes.
                </p>
                <p style="font-size: 14px; color: #6b7280;">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </div>
              <div class="footer">
                <p>RC Track Rental | Professional RC Track & Car Rentals</p>
                <p>This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Activate Your Account

Hi ${user.firstName},

You requested a new activation link. To activate your account, please visit:

${activationUrl}

This link expires in 30 minutes.

If you didn't request this, you can safely ignore this email.

RC Track Rental
        `,
      })

      console.log(`[ACTIVATION] Resend email to ${norm.original}`)
    } catch (err) {
      console.error("Failed to resend activation email", err)
      return NextResponse.json({ 
        error: "Failed to send email. Please try again later." 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: "Activation email sent! Please check your inbox." 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: error.issues[0].message 
      }, { status: 400 })
    }

    console.error("Resend activation error:", error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

