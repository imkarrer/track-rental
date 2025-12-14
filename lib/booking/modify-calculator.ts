import { Decimal } from "@prisma/client/runtime/library"
import { calculateRefundPercent } from "./refund-calculator"

/**
 * Calculate the financial impact of modifying a booking according to the algorithm:
 * 1. Check if a promo code was used, honor it throughout the modification
 * 2. First, do a soft refund of the day according to the refund policy
 * 3. Then, charge them for the price of the day(s) according to the day multiplier
 * 4. Compute the final price
 */
export interface ModifyCalculationInput {
  // Original booking details
  oldTotal: number // Original booking total (calculated)
  oldPromoDiscount: number // Original promo code discount applied
  oldEventDate: string // YYYY-MM-DD
  oldEndDate?: string | null // YYYY-MM-DD for multi-day bookings
  
  // New booking details
  newTotal: number // New calculated total without promo
  newEventDate: string // YYYY-MM-DD
  newEndDate?: string | null // YYYY-MM-DD for multi-day bookings
  
  // Refund policy
  refundPolicies: Array<{
    daysBeforeService: number
    nonRefundablePercent: Decimal
  }>
  daysUntilOriginalEvent: number
}

export interface ModifyCalculationResult {
  // Step 1: Promo preservation
  hasPromoCode: boolean
  promoCode: string | null
  promoDiscount: number
  
  // Step 2: Soft refund calculation (may be skipped for extensions)
  isExtension: boolean // True if just extending the booking (same start date)
  oldTotalWithPromo: number
  refundablePercent: number
  nonRefundablePercent: number
  softRefundAmount: number
  creditAmount: number // Amount available as credit after soft refund
  
  // Step 3: New charges
  newTotalWithPromo: number
  newChargeAmount: number // What the new booking costs (with promo applied)
  
  // Step 4: Final pricing
  netDifference: number // creditAmount - newChargeAmount
  action: "refund" | "payment" | "none"
  actionAmount: number // Amount to refund or charge
  finalBookingTotal: number // Final total of the booking
}

/**
 * Calculate the financial impact of modifying a booking
 * 
 * Algorithm:
 * 1. Honor promo code throughout modification (preserve the discount)
 * 2. Detect if this is an extension (same start date) vs a full reschedule
 * 3. For extensions: just charge the difference (no refund step)
 * 4. For reschedules: Calculate soft refund, then charge for new booking
 * 5. Net difference: credit from refund minus new charge
 */
export function calculateModifyFinancials(
  input: ModifyCalculationInput,
  promoCode: string | null = null
): ModifyCalculationResult {
  const {
    oldTotal,
    oldPromoDiscount,
    oldEventDate,
    oldEndDate,
    newTotal,
    newEventDate,
    newEndDate,
    refundPolicies,
    daysUntilOriginalEvent,
  } = input

  // ============================================================
  // STEP 1: Check if promo code was used, honor it throughout
  // ============================================================
  const hasPromoCode = !!promoCode && oldPromoDiscount > 0
  const promoDiscount = oldPromoDiscount

  // Apply promo to both old and new totals
  const oldTotalWithPromo = oldTotal - promoDiscount
  const newTotalWithPromo = newTotal - promoDiscount

  // ============================================================
  // STEP 1.5: Detect if this is an extension vs a reschedule
  // ============================================================
  // Extension: Start date stays the same, just adding/changing end date
  const isExtension = oldEventDate === newEventDate

  let refundablePercent = 0
  let nonRefundablePercent = 0
  let softRefundAmount = 0
  let creditAmount = 0
  let newChargeAmount = 0
  let netDifference = 0

  if (isExtension) {
    // ============================================================
    // EXTENSION LOGIC: No refund, just charge the difference
    // ============================================================
    refundablePercent = 100 // Not used for extensions
    nonRefundablePercent = 0 // Not used for extensions
    softRefundAmount = 0 // No refund for extensions
    creditAmount = oldTotalWithPromo // They keep their existing booking value
    newChargeAmount = newTotalWithPromo // New total cost
    netDifference = oldTotalWithPromo - newTotalWithPromo // Difference (usually negative for extensions)
  } else {
    // ============================================================
    // RESCHEDULE LOGIC: Do a soft refund according to the refund policy
    // ============================================================
    // Get the refund percentage based on cancellation policy
    // Convert Decimal to number for the calculation
    const policiesAsNumbers = refundPolicies.map(p => ({
      daysBeforeService: p.daysBeforeService,
      nonRefundablePercent: Number(p.nonRefundablePercent)
    }))
    
    refundablePercent = calculateRefundPercent(
      policiesAsNumbers,
      daysUntilOriginalEvent
    )
    nonRefundablePercent = 100 - refundablePercent

    // Calculate soft refund amount (credit we get back from old booking)
    softRefundAmount = oldTotalWithPromo * (refundablePercent / 100)
    creditAmount = softRefundAmount // This is our "credit" to apply

    // ============================================================
    // STEP 3: Charge for the new day(s) according to day multiplier
    // ============================================================
    // The newTotal already includes the day multiplier calculation
    // We just need to apply the promo code to honor it
    newChargeAmount = newTotalWithPromo

    // ============================================================
    // STEP 4: Compute the final price
    // ============================================================
    // Net difference: credit from refund minus what we need to charge
    netDifference = creditAmount - newChargeAmount
  }

  // Determine action and amount
  let action: "refund" | "payment" | "none" = "none"
  let actionAmount = 0

  if (netDifference > 0.01) {
    // We have excess credit - issue a refund
    action = "refund"
    actionAmount = netDifference
  } else if (netDifference < -0.01) {
    // We need more money - charge the difference
    action = "payment"
    actionAmount = Math.abs(netDifference)
  } else {
    // Net zero or negligible difference
    action = "none"
    actionAmount = 0
  }

  // Final booking total is the new total with promo applied
  const finalBookingTotal = newTotalWithPromo

  return {
    // Step 1: Promo preservation
    hasPromoCode,
    promoCode,
    promoDiscount: Math.round(promoDiscount * 100) / 100,
    
    // Step 2: Soft refund (may be skipped for extensions)
    isExtension,
    oldTotalWithPromo: Math.round(oldTotalWithPromo * 100) / 100,
    refundablePercent,
    nonRefundablePercent,
    softRefundAmount: Math.round(softRefundAmount * 100) / 100,
    creditAmount: Math.round(creditAmount * 100) / 100,
    
    // Step 3: New charges
    newTotalWithPromo: Math.round(newTotalWithPromo * 100) / 100,
    newChargeAmount: Math.round(newChargeAmount * 100) / 100,
    
    // Step 4: Final pricing
    netDifference: Math.round(netDifference * 100) / 100,
    action,
    actionAmount: Math.round(actionAmount * 100) / 100,
    finalBookingTotal: Math.round(finalBookingTotal * 100) / 100,
  }
}

/**
 * Helper function to explain the modification calculation in plain English
 */
export function explainModifyCalculation(result: ModifyCalculationResult): string {
  const lines: string[] = []
  
  lines.push("=== Booking Modification Calculation ===\n")
  
  // Step 1
  if (result.hasPromoCode) {
    lines.push(`✓ Promo code "${result.promoCode}" preserved throughout modification`)
    lines.push(`  Discount: $${result.promoDiscount.toFixed(2)}\n`)
  } else {
    lines.push("• No promo code applied\n")
  }
  
  if (result.isExtension) {
    // Extension logic
    lines.push("✓ This is a booking EXTENSION (same start date)")
    lines.push("  No cancellation fees apply!\n")
    
    lines.push(`--- Current Booking ---`)
    lines.push(`Current booking total (with promo): $${result.oldTotalWithPromo.toFixed(2)}\n`)
    
    lines.push(`--- Extended Booking ---`)
    lines.push(`Extended booking total (with promo): $${result.newTotalWithPromo.toFixed(2)}\n`)
    
    lines.push(`--- Additional Payment ---`)
    lines.push(`Additional cost: $${Math.abs(result.netDifference).toFixed(2)}\n`)
  } else {
    // Reschedule logic
    lines.push(`--- Step 1: Soft Refund of Original Booking ---`)
    lines.push(`Original booking total (with promo): $${result.oldTotalWithPromo.toFixed(2)}`)
    lines.push(`Refund policy: ${result.refundablePercent}% refundable, ${result.nonRefundablePercent}% non-refundable`)
    lines.push(`Soft refund amount (credit): $${result.softRefundAmount.toFixed(2)}\n`)
    
    lines.push(`--- Step 2: New Booking Charge ---`)
    lines.push(`New booking total (with promo): $${result.newTotalWithPromo.toFixed(2)}`)
    lines.push(`Amount to charge: $${result.newChargeAmount.toFixed(2)}\n`)
    
    lines.push(`--- Step 3: Final Calculation ---`)
    lines.push(`Credit from refund: $${result.creditAmount.toFixed(2)}`)
    lines.push(`Minus new charge: -$${result.newChargeAmount.toFixed(2)}`)
    lines.push(`Net difference: $${result.netDifference.toFixed(2)}\n`)
  }
  
  if (result.action === "refund") {
    lines.push(`✓ ACTION: Refund $${result.actionAmount.toFixed(2)} to customer`)
  } else if (result.action === "payment") {
    lines.push(`✓ ACTION: Charge $${result.actionAmount.toFixed(2)} from customer`)
  } else {
    lines.push(`✓ ACTION: No payment or refund needed`)
  }
  
  lines.push(`\nFinal booking total: $${result.finalBookingTotal.toFixed(2)}`)
  
  return lines.join("\n")
}

/**
 * Helper function to format calculation for customer display
 */
export function formatModifyCalculationForCustomer(result: ModifyCalculationResult): {
  summary: string
  details: string[]
} {
  const summary = result.action === "payment"
    ? `You need to pay an additional $${result.actionAmount.toFixed(2)}`
    : result.action === "refund"
    ? `You will receive a refund of $${result.actionAmount.toFixed(2)}`
    : "No additional payment needed"

  const details: string[] = []
  
  if (result.hasPromoCode) {
    details.push(`Your promo code "${result.promoCode}" is still applied`)
  }
  
  if (result.isExtension) {
    details.push(`You're extending your booking - no cancellation fees!`)
    details.push(`Current booking: $${result.oldTotalWithPromo.toFixed(2)}`)
    details.push(`Extended booking total: $${result.newTotalWithPromo.toFixed(2)}`)
  } else {
    details.push(`Original booking: $${result.oldTotalWithPromo.toFixed(2)}`)
    
    if (result.refundablePercent < 100) {
      details.push(
        `Credit from original booking (${result.refundablePercent}% refundable): $${result.creditAmount.toFixed(2)}`
      )
    } else {
      details.push(`Credit from original booking: $${result.creditAmount.toFixed(2)}`)
    }
    
    details.push(`New booking total: $${result.newTotalWithPromo.toFixed(2)}`)
  }
  
  if (result.action === "payment") {
    details.push(`Additional payment needed: $${result.actionAmount.toFixed(2)}`)
  } else if (result.action === "refund") {
    details.push(`Refund amount: $${result.actionAmount.toFixed(2)}`)
  }

  return { summary, details }
}

/**
 * Helper function to create a log-friendly JSON representation
 */
export function serializeModifyCalculation(result: ModifyCalculationResult): Record<string, any> {
  return {
    step1_promo: {
      hasPromoCode: result.hasPromoCode,
      promoCode: result.promoCode,
      promoDiscount: result.promoDiscount,
    },
    step2_softRefund: {
      oldTotalWithPromo: result.oldTotalWithPromo,
      refundablePercent: result.refundablePercent,
      nonRefundablePercent: result.nonRefundablePercent,
      softRefundAmount: result.softRefundAmount,
      creditAmount: result.creditAmount,
    },
    step3_newCharge: {
      newTotalWithPromo: result.newTotalWithPromo,
      newChargeAmount: result.newChargeAmount,
    },
    step4_final: {
      netDifference: result.netDifference,
      action: result.action,
      actionAmount: result.actionAmount,
      finalBookingTotal: result.finalBookingTotal,
    },
  }
}
