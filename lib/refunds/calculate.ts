import { prisma } from "@/lib/db/prisma"
import { Decimal } from "@prisma/client/runtime/library"

/**
 * Calculate non-refundable amount based on cancellation date and service date
 * Uses refund policies configured by admin
 */
export async function calculateNonRefundableAmount(
  bookingTotal: number | Decimal,
  serviceDate: Date,
  cancellationDate: Date = new Date()
): Promise<{
  nonRefundableAmount: number
  refundableAmount: number
  daysBeforeService: number
  policyUsed: { daysBeforeService: number; nonRefundablePercent: number } | null
}> {
  const total = Number(bookingTotal)
  
  // Calculate days before service
  const daysBeforeService = Math.floor(
    (serviceDate.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Get all active refund policies, ordered by daysBeforeService (descending)
  // We want to find the policy that applies (daysBeforeService >= policy.daysBeforeService)
  const policies = await prisma.refundPolicy.findMany({
    where: { isActive: true },
    orderBy: { daysBeforeService: "desc" },
  })

  // Find the applicable policy (first policy where daysBeforeService >= policy.daysBeforeService)
  let applicablePolicy = null
  for (const policy of policies) {
    if (daysBeforeService >= policy.daysBeforeService) {
      applicablePolicy = policy
      break
    }
  }

  // If no policy applies, check if we're past the service date (100% non-refundable)
  if (!applicablePolicy) {
    if (daysBeforeService < 0) {
      // Past service date - 100% non-refundable
      return {
        nonRefundableAmount: total,
        refundableAmount: 0,
        daysBeforeService,
        policyUsed: { daysBeforeService: 0, nonRefundablePercent: 100 },
      }
    }
    // No policy applies, default to 0% non-refundable (full refund)
    return {
      nonRefundableAmount: 0,
      refundableAmount: total,
      daysBeforeService,
      policyUsed: null,
    }
  }

  // Calculate non-refundable amount based on policy
  const nonRefundablePercent = Number(applicablePolicy.nonRefundablePercent)
  const nonRefundableAmount = (total * nonRefundablePercent) / 100
  const refundableAmount = total - nonRefundableAmount

  return {
    nonRefundableAmount: Math.round(nonRefundableAmount * 100) / 100,
    refundableAmount: Math.round(refundableAmount * 100) / 100,
    daysBeforeService,
    policyUsed: {
      daysBeforeService: applicablePolicy.daysBeforeService,
      nonRefundablePercent,
    },
  }
}

/**
 * Get refund calculation preview for a booking
 */
export async function getRefundCalculation(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      refunds: true,
    },
  })

  if (!booking) {
    throw new Error("Booking not found")
  }

  const serviceDate = new Date(booking.eventDate)
  const calculation = await calculateNonRefundableAmount(
    booking.total,
    serviceDate,
    new Date()
  )

  // Calculate remaining refundable amount (total - already refunded - non-refundable)
  const alreadyRefunded = Number(booking.totalRefunded)
  const maxRefundable = calculation.refundableAmount
  const remainingRefundable = Math.max(0, maxRefundable - alreadyRefunded)

  return {
    ...calculation,
    bookingTotal: Number(booking.total),
    alreadyRefunded,
    maxRefundable,
    remainingRefundable,
    canRefundFull: remainingRefundable >= calculation.refundableAmount,
  }
}

/**
 * Calculate refund breakdown including original amount and rescheduling penalties
 * Uses BookingHistory to reconstruct the financial history
 */
export async function getRefundBreakdown(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      refunds: true,
      history: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!booking) {
    throw new Error("Booking not found")
  }

  // Find the original booking amount from CREATED entry
  const createdEntry = booking.history.find(h => h.actionType === "CREATED")
  const originalTotal = createdEntry?.newTotal 
    ? Number(createdEntry.newTotal) 
    : Number(booking.total) // Fallback to current total if no history

  // Calculate rescheduling penalties from modification history
  let reschedulingPenalty = 0
  let currentTotal = originalTotal

  // Track through all modifications to calculate penalties
  for (const entry of booking.history) {
    if (
      entry.actionType === "MODIFIED_DATE" ||
      entry.actionType === "MODIFIED_BOTH" ||
      entry.actionType === "MODIFIED_CARS"
    ) {
      const oldTotal = entry.oldTotal ? Number(entry.oldTotal) : currentTotal
      const newTotal = entry.newTotal ? Number(entry.newTotal) : currentTotal
      const refundAmount = entry.refundAmount ? Number(entry.refundAmount) : 0
      
      // Calculate penalty: price difference minus refunded amount
      const priceDifference = oldTotal - newTotal
      if (priceDifference > 0) {
        // Customer paid more originally, got partial refund
        const penalty = priceDifference - refundAmount
        reschedulingPenalty += penalty
      }
      
      currentTotal = newTotal
    }
  }

  const currentBookingTotal = Number(booking.total)
  const alreadyRefunded = Number(booking.totalRefunded)
  
  // Calculate what can be refunded from current booking
  const serviceDate = new Date(booking.eventDate)
  const currentCalculation = await calculateNonRefundableAmount(
    currentBookingTotal,
    serviceDate,
    new Date()
  )

  // Calculate cancellation penalty (non-refundable portion of current booking)
  const cancellationPenalty = currentCalculation.nonRefundableAmount

  // Calculate full refund available (original amount minus already refunded)
  const fullRefundAvailable = Math.max(0, originalTotal - alreadyRefunded)

  return {
    originalTotal,
    currentBookingTotal,
    reschedulingPenalty,
    cancellationPenalty,
    alreadyRefunded,
    currentRefundable: currentCalculation.refundableAmount,
    remainingRefundable: Math.max(0, currentCalculation.refundableAmount - alreadyRefunded),
    fullRefundAvailable,
    breakdown: {
      originalAmountPaid: originalTotal,
      reschedulingPenalties: reschedulingPenalty,
      currentBookingValue: currentBookingTotal,
      alreadyRefunded,
      cancellationPenalty,
      remainingRefundablePerPolicy: Math.max(0, currentCalculation.refundableAmount - alreadyRefunded),
      fullRefundAvailableWithOverride: fullRefundAvailable,
    },
  }
}

