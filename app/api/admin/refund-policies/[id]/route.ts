import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const updateRefundPolicySchema = z.object({
  daysBeforeService: z.number().int().min(0).optional(),
  nonRefundablePercent: z.number().min(0).max(100).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// PUT - Update a refund policy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updateRefundPolicySchema.parse(body)

    // If updating daysBeforeService, check for conflicts
    if (data.daysBeforeService !== undefined) {
      const existing = await prisma.refundPolicy.findUnique({
        where: { daysBeforeService: data.daysBeforeService },
      })

      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "A policy with this number of days already exists" },
          { status: 400 }
        )
      }
    }

    const policy = await prisma.refundPolicy.update({
      where: { id },
      data,
    })

    return NextResponse.json({ policy })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating refund policy:", error)
    return NextResponse.json(
      { error: "Failed to update refund policy" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a refund policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await prisma.refundPolicy.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting refund policy:", error)
    return NextResponse.json(
      { error: "Failed to delete refund policy" },
      { status: 500 }
    )
  }
}

