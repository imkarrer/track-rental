/**
 * Calculate the refund percentage based on days until service
 * and active refund policies.
 */
export function calculateRefundPercent(
  policies: Array<{
    daysBeforeService: number
    nonRefundablePercent: number
  }>,
  daysUntilService: number
): number {
  if (daysUntilService < 0) {
    // After service date, no refund
    return 0
  }

  // Sort policies by daysBeforeService descending (already sorted in most queries)
  const sortedPolicies = [...policies].sort(
    (a, b) => b.daysBeforeService - a.daysBeforeService
  )

  // Find the first policy that applies
  for (const policy of sortedPolicies) {
    if (daysUntilService >= policy.daysBeforeService) {
      // Convert non-refundable % to refund %
      return 100 - policy.nonRefundablePercent
    }
  }

  // If no policy matches, full refund
  return 100
}

