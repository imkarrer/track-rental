import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const updatePromoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
})

// PATCH - Update promotional code
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updatePromoSchema.parse(body)

    // Verify it's an admin code
    const existingCode = await prisma.referralCode.findUnique({
      where: { id },
    })

    if (!existingCode) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 })
    }

    // Verify it's an admin code (no owner = admin code)
    if (existingCode.ownerUserId !== null) {
      return NextResponse.json(
        { error: "Cannot update user referral codes through this endpoint" },
        { status: 400 }
      )
    }

    // Update the code
    const updatedCode = await prisma.referralCode.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        redemptions: {
          include: {
            user: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ promoCode: updatedCode })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Error updating promo code:", error)
    return NextResponse.json({ error: "Failed to update promo code" }, { status: 500 })
  }
}

// DELETE - Delete promotional code
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    // Verify it's an admin code
    const existingCode = await prisma.referralCode.findUnique({
      where: { id },
    })

    if (!existingCode) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 })
    }

    // Verify it's an admin code (no owner = admin code)
    if (existingCode.ownerUserId !== null) {
      return NextResponse.json(
        { error: "Cannot delete user referral codes through this endpoint" },
        { status: 400 }
      )
    }

    // Delete the code
    await prisma.referralCode.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting promo code:", error)
    return NextResponse.json({ error: "Failed to delete promo code" }, { status: 500 })
  }
}

