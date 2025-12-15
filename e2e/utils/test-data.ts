/**
 * Test data utilities for E2E tests
 */

/**
 * Generate a future date for booking tests
 * @param daysFromNow Number of days in the future
 */
export function getFutureDate(daysFromNow: number = 7): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().split('T')[0] // YYYY-MM-DD format
}

/**
 * Generate test booking data
 */
export function getTestBookingData() {
  const eventDate = getFutureDate(7) // 1 week from now
  
  return {
    eventDate,
    startTime: '09:00',
    endTime: '17:00',
    eventAddress: '123 Test Street',
    eventCity: 'Los Angeles',
    eventState: 'CA',
    eventZip: '90001',
    availableSpaceLength: '50',
    availableSpaceWidth: '30',
  }
}

/**
 * Get modified booking data (different date)
 */
export function getModifiedBookingData() {
  const eventDate = getFutureDate(14) // 2 weeks from now
  
  return {
    eventDate,
    startTime: '10:00',
    endTime: '18:00',
  }
}

/**
 * Get Stripe test card details
 * These are official Stripe test cards that work in test mode
 */
export function getStripeTestCard() {
  // Use environment variable if provided, otherwise use Stripe test card
  return {
    cardNumber: process.env.TEST_STRIPE_CARD_NUMBER || '4242424242424242',
    expiry: process.env.TEST_STRIPE_CARD_EXPIRY || '12/34',
    cvc: process.env.TEST_STRIPE_CARD_CVC || '123',
    zipCode: process.env.TEST_STRIPE_CARD_ZIP || '90001',
  }
}

/**
 * Generate a unique email for testing
 * Useful for registration tests
 */
export function generateUniqueEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `test-${timestamp}-${random}@example.com`
}
