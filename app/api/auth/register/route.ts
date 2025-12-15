import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { hashPassword } from "@/lib/auth/helpers"
import { z } from "zod"
import { normalizeEmail } from "@/lib/auth/email-normalize"
import { sendEmail } from "@/lib/email/send"

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validatedData = registerSchema.parse(body)

    const norm = normalizeEmail(validatedData.email)
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { emailCanonical: norm.canonical },
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }
    
    // Hash password
    const passwordHash = await hashPassword(validatedData.password)
    const activationToken = crypto.randomUUID()
    const activationExpires = new Date(Date.now() + 1000 * 60 * 30) // 30 minutes
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: norm.original.toLowerCase(),
        emailCanonical: norm.canonical,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        role: "USER",
        activationToken,
        activationExpires,
      },
    })

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
                <h1>🏁 Welcome to RC Track Rental!</h1>
              </div>
              <div class="content">
                <p>Hi ${validatedData.firstName},</p>
                <p>Thanks for signing up! We're excited to have you join our community of RC racing enthusiasts.</p>
                <p><strong>To get started, please activate your account by clicking the button below:</strong></p>
                <div style="text-align: center;">
                  <a href="${activationUrl}" class="button">Activate My Account</a>
                </div>
                <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
                <p style="font-size: 12px; word-break: break-all; background: #fff; padding: 10px; border-radius: 4px;">${activationUrl}</p>
                <p style="margin-top: 20px; font-size: 14px; color: #ef4444;">
                  ⏰ <strong>Important:</strong> This activation link expires in 30 minutes for security reasons.
                </p>
                <p style="font-size: 14px; color: #6b7280;">
                  If you didn't create this account, you can safely ignore this email.
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
Welcome to RC Track Rental!

Hi ${validatedData.firstName},

Thanks for signing up! To activate your account, please visit:

${activationUrl}

This link expires in 30 minutes.

If you didn't create this account, you can safely ignore this email.

RC Track Rental
        `,
      })
      
      console.log(`[ACTIVATION] Email sent to ${norm.original}`)
    } catch (err) {
      console.error("Failed to send activation email", err)
      // Don't fail the registration if email fails
    }
    
    return NextResponse.json(
      { message: "User created; check email to activate", userId: user.id },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

