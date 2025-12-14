/**
 * E2E Test: Complete Booking Lifecycle
 * 
 * This test exercises the full booking workflow:
 * 1. Book a track rental with payment
 * 2. Modify the booking (change date/time)
 * 3. Issue a full refund
 * 
 * This serves as a synthetic monitoring test to verify system health.
 */

import { test, expect } from './fixtures/auth'
import { 
  getTestBookingData, 
  getModifiedBookingData, 
  getStripeTestCard 
} from './utils/test-data'
import { 
  waitForStripeForm, 
  retryWithBackoff,
  selectCardPaymentMethod,
  waitForCardInput,
  navigateCalendarMonths
} from './utils/wait-helpers'

/**
 * Get the track ID to use for testing.
 * 
 * When running in production with a test-only track (hidden from public):
 * - Set TEST_TRACK_ID to the UUID of the test track
 * - The test will navigate directly to that track
 * 
 * For local/CI testing without a specific track:
 * - Leave TEST_TRACK_ID unset
 * - The test will pick the first available track from the tracks page
 */
function getTestTrackId(): string | undefined {
  return process.env.TEST_TRACK_ID
}

test.describe('Complete Booking Lifecycle', () => {
  let bookingId: string
  let bookingNumber: string // Short display number (first 8 chars of UUID)

  // Clean up reservations after each test to prevent conflicts
  test.afterEach(async ({ authenticatedPage: page }) => {
    try {
      // Call the cleanup API to remove expired reservations
      // This helps prevent date conflicts in subsequent test runs
      const baseURL = process.env.BASE_URL || 'http://localhost:3000'
      const response = await page.request.post(`${baseURL}/api/cron/cleanup-reservations`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok()) {
        const result = await response.json()
        console.log(`🧹 Cleaned up ${result.deleted || 0} expired reservation(s) after test`)
      } else {
        console.log(`⚠️ Cleanup API returned ${response.status()}, skipping cleanup`)
      }
    } catch (error) {
      // Don't fail the test if cleanup fails
      console.log(`⚠️ Failed to clean up reservations: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  test('should complete full booking lifecycle: book → modify → refund', async ({ authenticatedPage: page }) => {
    // This is a long-running test - increase timeout to 5 minutes to account for auth fixture time
    test.setTimeout(300000)
    // Avoid per-step 30s ceilings that were killing video capture
    page.setDefaultTimeout(45000)
    page.setDefaultNavigationTimeout(60000)
    
    const bookingData = getTestBookingData()
    const modifiedData = getModifiedBookingData()
    const stripeCard = getStripeTestCard()

    // ============================================
    // STEP 1: BOOK A TRACK
    // ============================================
    const testTrackId = getTestTrackId()
    
    if (testTrackId) {
      // Production mode: Navigate directly to the configured test track
      await test.step('Navigate directly to test track', async () => {
        console.log(`📍 Using configured TEST_TRACK_ID: ${testTrackId}`)
        
        // Wait for session to load (React hydration)
        const loadingIndicator = page.getByTestId('nav-loading')
        if (await loadingIndicator.isVisible().catch(() => false)) {
          await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 })
        }
        
        // Navigate directly to the test track
        const baseURL = process.env.BASE_URL || 'http://localhost:3000'
        await page.goto(`${baseURL}/tracks/${testTrackId}`)
        
        // Wait for navigation to complete
        await page.waitForURL(`**/tracks/${testTrackId}`, { timeout: 15000 })
      })
    } else {
      // Local/CI mode: Browse tracks page and select the first one
      await test.step('Navigate to tracks page', async () => {
        // Wait for session to load (React hydration)
        const loadingIndicator = page.getByTestId('nav-loading')
        if (await loadingIndicator.isVisible().catch(() => false)) {
          await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 })
        }
        
        // Wait for link and click it
        const link = page.getByTestId('nav-tracks-link')
        await expect(link).toBeVisible({ timeout: 10000 })
        await expect(link).toBeEnabled({ timeout: 10000 })
        
        // Click FIRST, then set up watchers (prevents "Test ended" errors)
        await link.click({ timeout: 10000 })
        
        // Wait for navigation - set up watchers AFTER click completes
        await Promise.all([
          page.waitForResponse(
            (resp) => resp.url().includes('/api/tracks') && resp.request().method() === 'GET',
            { timeout: 20000 }
          ).catch(() => null),
          page.waitForURL('**/tracks', { timeout: 15000 })
        ])
        
        // Verify navigation succeeded
        await expect(page).toHaveURL(/\/tracks$/, { timeout: 20000 })
        
        // Wait for track cards to load
        const firstTrackCard = page.locator('[data-testid^="track-card-"]').first()
        await expect(firstTrackCard).toBeVisible({ timeout: 15000 })
      })

      await test.step('Select a track', async () => {
        // Get the first track card and its "View Details" button
        const firstTrackCard = page.locator('[data-testid^="track-card-"]').first()
        const viewDetailsButton = firstTrackCard.locator('[data-testid^="track-view-details-button-"]')
        
        // Wait for button to be ready
        await expect(viewDetailsButton).toBeVisible({ timeout: 10000 })
        
        // Click FIRST, then wait for navigation (prevents "Test ended" errors)
        await viewDetailsButton.click({ timeout: 10000 })
        
        // Wait for navigation to track detail page
        await page.waitForURL(/\/tracks\/[^\/]+$/, { timeout: 15000 })
      })
    }

    await test.step('Select cars on track detail page', async () => {
      // Wait for track detail page to load
      await expect(page.locator('text=/Select Your Cars/i')).toBeVisible({ timeout: 15000 })
      
      // Verify we see the car selection interface
      await expect(page.getByTestId('track-detail-car-selection-count')).toBeVisible({ timeout: 10000 })
      
      // Wait for "Continue to Booking" button and click it
      const continueButton = page.getByTestId('track-detail-continue-booking-button')
      await expect(continueButton).toBeEnabled({ timeout: 10000 })
      
      // Click FIRST, then wait for navigation (prevents "Test ended" errors)
      await continueButton.click({ timeout: 10000 })
      
      // Wait for navigation to booking page
      await page.waitForURL(/\/book\?trackId=/, { timeout: 15000 })
    })

    await test.step('Fill in booking details (Step 1)', async () => {
      // Wait for the booking form to load
      await expect(page.getByTestId('booking-step1-event-details')).toBeVisible({ timeout: 20000 })
      
      // Wait for date picker calendar to be ready
      const datePicker = page.getByTestId('booking-date-picker')
      await expect(datePicker).toBeVisible({ timeout: 15000 })
      
      // Wait a bit for the calendar to fully render and initialize
      await page.waitForTimeout(500)
      
      // Navigate forward 6 months to avoid collisions with existing dates
      console.log('📅 Navigating calendar forward 6 months to avoid date conflicts...')
      await navigateCalendarMonths(page, datePicker, 6)
      
      // Find an available (non-disabled) date to click
      // DayPicker renders dates as buttons - we need to find one that's not disabled
      const availableDayButtons = datePicker.locator('button.rdp-day:not(.rdp-day_disabled):not(.rdp-day_outside)')
      
      // Wait for at least one available date to appear
      await expect(availableDayButtons.first()).toBeVisible({ timeout: 10000 })
      
      // Try to find the target date first, otherwise use first available
      const eventDate = new Date(bookingData.eventDate + 'T00:00:00')
      const targetDayOfMonth = String(eventDate.getDate())
      
      // Try to find a button with our target day number that's available
      const targetDayButton = datePicker.locator(`button.rdp-day:not(.rdp-day_disabled):not(.rdp-day_outside)`).filter({ 
        hasText: new RegExp(`^${targetDayOfMonth}$`) 
      }).first()
      
      let dayButton
      let selectedDate: string | null = null
      
      // Check if target date is available and clickable
      const targetVisible = await targetDayButton.isVisible({ timeout: 2000 }).catch(() => false)
      if (targetVisible) {
        // Wait for target button to be stable and clickable
        await targetDayButton.scrollIntoViewIfNeeded()
        // Check if it's actually enabled (not just visible)
        const isEnabled = await targetDayButton.isEnabled({ timeout: 2000 }).catch(() => false)
        if (isEnabled) {
          dayButton = targetDayButton
          selectedDate = bookingData.eventDate
        }
      }
      
      // Fallback to first available date if target not available or not enabled
      if (!dayButton) {
        const availableCount = await availableDayButtons.count()
        if (availableCount === 0) {
          throw new Error('No available dates found in calendar - all dates may be booked')
        }
        
        // Find the first actually enabled button
        for (let i = 0; i < Math.min(availableCount, 10); i++) {
          const candidate = availableDayButtons.nth(i)
          await candidate.scrollIntoViewIfNeeded()
          const isEnabled = await candidate.isEnabled({ timeout: 1000 }).catch(() => false)
          if (isEnabled) {
            dayButton = candidate
            break
          }
        }
        
        if (!dayButton) {
          throw new Error('Found available date buttons but none are enabled/clickable')
        }
        
        console.log(`⚠️ Target date ${bookingData.eventDate} not available or not enabled, selecting first enabled date`)
      }
      
      // Final check and click
      await dayButton.scrollIntoViewIfNeeded()
      await expect(dayButton).toBeVisible({ timeout: 5000 })
      
      // Use force click if normal click fails (for cases where button appears disabled but is actually clickable)
      try {
        await dayButton.click({ timeout: 5000 })
      } catch (error) {
        // If normal click fails, try force click as fallback
        console.log('Normal click failed, trying force click')
        await dayButton.click({ force: true, timeout: 5000 })
      }
      
      const startTimeInput = page.getByTestId('booking-start-time-input')
      await expect(startTimeInput).toBeVisible({ timeout: 10000 })
      await startTimeInput.fill(bookingData.startTime)
      
      const endTimeInput = page.getByTestId('booking-end-time-input')
      await expect(endTimeInput).toBeVisible({ timeout: 10000 })
      await endTimeInput.fill(bookingData.endTime)
      
      // Fill in address
      const addressInput = page.getByTestId('booking-event-address-input')
      await expect(addressInput).toBeVisible({ timeout: 10000 })
      await addressInput.fill(bookingData.eventAddress)
      
      const cityInput = page.getByTestId('booking-event-city-input')
      await expect(cityInput).toBeVisible({ timeout: 10000 })
      await cityInput.fill(bookingData.eventCity)
      
      const stateInput = page.getByTestId('booking-event-state-input')
      await expect(stateInput).toBeVisible({ timeout: 10000 })
      await stateInput.fill(bookingData.eventState)
      
      const zipInput = page.getByTestId('booking-event-zip-input')
      await expect(zipInput).toBeVisible({ timeout: 10000 })
      await zipInput.fill(bookingData.eventZip)
      
      // Fill in space dimensions
      const lengthInput = page.getByTestId('booking-space-length-input')
      await expect(lengthInput).toBeVisible({ timeout: 10000 })
      await lengthInput.fill(bookingData.availableSpaceLength)
      
      const widthInput = page.getByTestId('booking-space-width-input')
      await expect(widthInput).toBeVisible({ timeout: 10000 })
      await widthInput.fill(bookingData.availableSpaceWidth)
      
      // Wait for button to be ready
      const reserveButton = page.getByTestId('booking-reserve-dates-button')
      await reserveButton.scrollIntoViewIfNeeded()
      await expect(reserveButton).toBeEnabled({ timeout: 15000 })
      
      // Click FIRST, then wait for API response, pricing card, and Step 2 (prevents "Test ended" errors)
      await reserveButton.click({ timeout: 10000 })
      
      // Wait for reservation API call to complete, price breakdown to load, then Step 2 should appear
      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/reservations/create') && resp.request().method() === 'POST',
          { timeout: 20000 }
        ).catch(() => null),
        // Wait for price breakdown card to appear (indicates pricing has loaded)
        expect(page.getByTestId('booking-price-breakdown')).toBeVisible({ timeout: 20000 })
      ])
      
      // Now wait for Step 2 to appear after pricing is loaded
      await expect(page.getByTestId('booking-step2-car-selection')).toBeVisible({ timeout: 20000 })
    })

    await test.step('Select cars and proceed to checkout (Step 2)', async () => {
      // Cars should be pre-selected (first 2 included free)
      // Just verify we're on the right step and proceed
      await expect(page.locator('text=/First 2 cars are included FREE/i')).toBeVisible({ timeout: 10000 })
      
      // Wait for button to be ready
      const proceedButton = page.getByTestId('booking-proceed-checkout-button')
      await proceedButton.scrollIntoViewIfNeeded()
      await expect(proceedButton).toBeEnabled({ timeout: 15000 })
      
      // Click FIRST, then wait for Step 3 (prevents "Test ended" errors)
      await proceedButton.click({ timeout: 10000 })
      
      // Wait for Step 3 (Payment) to appear
      await expect(page.getByTestId('booking-step3-payment')).toBeVisible({ timeout: 15000 })
    })

    await test.step('Complete payment (Step 3)', async () => {
      // Verify we're on the payment step
      await expect(page.getByTestId('booking-step3-payment')).toBeVisible({ timeout: 10000 })
      
      // Acknowledge refund policy
      const confirmCheckbox = page.getByTestId('booking-refund-policy-checkbox')
      await expect(confirmCheckbox).toBeVisible()
      await confirmCheckbox.check()
      
      // Wait for Stripe form to load
      await waitForStripeForm(page, 15000)
      
      // Select Card payment method if available (may already be selected)
      await selectCardPaymentMethod(page, 10000)
      
      // Wait for card input to be available
      const cardInputResult = await waitForCardInput(page, 10000)
      if (!cardInputResult) {
        throw new Error('Could not find card number input in Stripe PaymentElement')
      }
      
      // Fill card details in Stripe iframe
      const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"][src*="elements-inner-payment"]')
      await cardInputResult.input.fill(stripeCard.cardNumber)
      await stripeFrame.locator('input[name="expiry"]').fill(stripeCard.expiry)
      await stripeFrame.locator('input[name="cvc"]').fill(stripeCard.cvc)
      await stripeFrame.locator('input[name="postalCode"]').fill(stripeCard.zipCode)
      
      // Submit payment
      const submitButton = page.locator('button[type="submit"]:has-text("Pay")')
      await expect(submitButton).toBeEnabled()
      await submitButton.click()
      
      // Wait for success page
      await page.waitForURL(/\/bookings\/success/, { timeout: 15000 })
      await expect(page.getByTestId('booking-success-page')).toBeVisible()
      await expect(page.getByTestId('booking-success-title')).toHaveText(/Booking Confirmed/i, { timeout: 10000 })
      
      // Capture the booking number
      const bookingNumberElement = page.getByTestId('booking-success-number')
      await expect(bookingNumberElement).toBeVisible()
      bookingNumber = await bookingNumberElement.textContent() || ''
      console.log('✅ Booking confirmed:', bookingNumber)
    })

    await test.step('Navigate to bookings and verify booking created', async () => {
      // Click on "My Bookings" link in header to navigate naturally
      await page.getByTestId('nav-bookings-link').click()
      
      // Find the booking by its booking number
      const bookingCard = page.locator(`[data-testid^="booking-card-"]`).filter({
        has: page.locator(`[data-testid^="booking-number-"]`, { hasText: bookingNumber })
      }).first()
      
      await expect(bookingCard).toBeVisible({ timeout: 10000 })
      
      // Verify it shows confirmed status
      const statusBadge = bookingCard.locator('[data-testid^="booking-status-"]')
      await expect(statusBadge).toHaveText(/confirmed/i)
      
      // Verify the booking number is displayed correctly
      const displayedNumber = bookingCard.locator(`[data-testid^="booking-number-"]`)
      await expect(displayedNumber).toHaveText(bookingNumber)
      
      console.log(`✅ Booking ${bookingNumber} created and verified successfully`)
    })

    await test.step('Verify booking appears in admin/bookings without fallback warning', async () => {
      // Navigate to admin page
      const adminLink = page.getByTestId('nav-admin-link')
      await expect(adminLink).toBeVisible({ timeout: 10000 })
      await adminLink.click()
      
      // Wait for admin dashboard to load
      await page.waitForURL(/\/admin/, { timeout: 15000 })
      
      // Navigate to admin bookings page
      await page.goto('/admin/bookings')
      await page.waitForLoadState('networkidle', { timeout: 15000 })
      
      // Wait for bookings to load
      await expect(page.locator('h2:has-text("Bookings")')).toBeVisible({ timeout: 10000 })
      
      // Find the booking card by looking for the CardTitle containing the booking number
      // Admin page shows "Booking #{booking.id.slice(0, 8)} - {track.name}" format
      const bookingHeading = page.locator('h3').filter({ hasText: new RegExp(`Booking #${bookingNumber}`) })
      await expect(bookingHeading).toBeVisible({ timeout: 10000 })
      
      // Find the card container by locating the nearest parent div that contains both the heading and status
      // Use a more reliable approach: find the card by looking for a container that has the heading
      const bookingCard = page.locator('div[class*="space-y-4"] > div').filter({
        has: bookingHeading
      }).first()
      
      await expect(bookingCard).toBeVisible({ timeout: 5000 })
      
      // Verify the booking status shows CONFIRMED
      // Find the grid container first (contains all booking details)
      const gridContainer = bookingCard.locator('div[class*="grid"][class*="grid-cols"]')
      await expect(gridContainer).toBeVisible({ timeout: 5000 })
      
      // Find the div that contains "Status:" text - it's a direct child of the grid
      // Use .first() to get the specific status div (not the parent containers)
      const statusDiv = gridContainer.locator('div').filter({ hasText: /Status:/ }).first()
      await expect(statusDiv).toBeVisible({ timeout: 5000 })
      
      // Badge component renders as a div with classes including "rounded-full"
      // Use getByText with exact match, scoped to the statusDiv to find the badge
      const statusBadge = statusDiv.getByText('CONFIRMED', { exact: true })
      await expect(statusBadge).toBeVisible({ timeout: 5000 })
      
      // Verify the badge has the correct classes (it's a Badge component)
      await expect(statusBadge).toHaveClass(/rounded-full/)
      
      // Verify there is NO fallback warning badge
      // The fallback badge has text "⚠️ Fallback" and should not exist
      const fallbackBadge = statusDiv.getByText('⚠️ Fallback', { exact: true })
      await expect(fallbackBadge).not.toBeVisible({ timeout: 2000 })
      
      console.log(`✅ Booking ${bookingNumber} verified in admin/bookings without fallback warning`)
    })

        // ============================================
    // STEP 2: MODIFY THE BOOKING
    // ============================================
    await test.step('Navigate to My Bookings page', async () => {
      // We're currently on the admin page from the previous step
      // Navigate to the My Bookings page using the navigation link
      const bookingsLink = page.getByTestId('nav-bookings-link')
      await expect(bookingsLink).toBeVisible({ timeout: 10000 })
      await expect(bookingsLink).toBeEnabled({ timeout: 10000 })
      
      // Click FIRST, then wait for navigation (prevents "Test ended" errors)
      await bookingsLink.click({ timeout: 10000 })
      
      // Wait for navigation to bookings page
      await page.waitForURL(/\/bookings/, { timeout: 15000 })
      
      // Verify we're on the bookings page
      await expect(page).toHaveURL(/\/bookings$/, { timeout: 10000 })
      
      // Wait for bookings to load
      await expect(page.locator('text=/My Bookings/i')).toBeVisible({ timeout: 10000 })
    })

    await test.step('Click modify button on booking card', async () => {
      // We should now be on the bookings page
      // Find the booking card by its booking number
      const bookingCard = page.locator(`[data-testid^="booking-card-"]`).filter({
        has: page.locator(`[data-testid^="booking-number-"]`, { hasText: bookingNumber })
      }).first()
      
      await expect(bookingCard).toBeVisible({ timeout: 10000 })
      
      // Find and click the modify button
      const modifyButton = bookingCard.locator(`[data-testid^="booking-modify-button-"]`)
      await expect(modifyButton).toBeVisible({ timeout: 10000 })
      await expect(modifyButton).toBeEnabled({ timeout: 10000 })
      
      // Click FIRST, then wait for navigation (prevents "Test ended" errors)
      await modifyButton.click({ timeout: 10000 })
      
      // Wait for navigation to modify page
      await page.waitForURL(/\/bookings\/modify\?bookingId=/, { timeout: 15000 })
      
      // Extract booking ID from URL for later use
      const url = page.url()
      const bookingIdMatch = url.match(/bookingId=([a-f0-9-]+)/)
      if (bookingIdMatch) {
        bookingId = bookingIdMatch[1]
        console.log(`📝 Captured booking ID: ${bookingId}`)
      }
    })

    await test.step('Select a new date for the booking', async () => {
      // Wait for the modify page to load
      await expect(page.getByTestId('modify-step1-card')).toBeVisible({ timeout: 15000 })
      
      // Wait for date picker calendar to be ready
      // The BookingDateRangePicker uses DayPicker which renders with .rdp class
      // Since modify page doesn't pass a test ID, we use the .rdp class selector
      // The calendar should already be showing the booking's month (via defaultMonth prop)
      const datePicker = page.locator('.rdp').first()
      await expect(datePicker).toBeVisible({ timeout: 15000 })
      
      // Wait a bit for the calendar to fully render and initialize
      await page.waitForTimeout(500)
      
      // Calendar should already be on the booking's month - no need to navigate
      // Find an available (non-disabled) date to click
      // DayPicker renders dates as buttons - we need to find one that's not disabled
      const availableDayButtons = datePicker.locator('button.rdp-day:not(.rdp-day_disabled):not(.rdp-day_outside)')
      
      // Wait for at least one available date to appear
      await expect(availableDayButtons.first()).toBeVisible({ timeout: 10000 })
      
      // Try to find the target date first, otherwise use first available
      const newEventDate = new Date(modifiedData.eventDate + 'T00:00:00')
      const targetDayOfMonth = String(newEventDate.getDate())
      
      // Try to find a button with our target day number that's available
      const targetDayButton = datePicker.locator(`button.rdp-day:not(.rdp-day_disabled):not(.rdp-day_outside)`).filter({ 
        hasText: new RegExp(`^${targetDayOfMonth}$`) 
      }).first()
      
      let dayButton
      let selectedDate: string | null = null
      
      // Check if target date is available and clickable
      const targetVisible = await targetDayButton.isVisible({ timeout: 2000 }).catch(() => false)
      if (targetVisible) {
        // Wait for target button to be stable and clickable
        await targetDayButton.scrollIntoViewIfNeeded()
        // Check if it's actually enabled (not just visible)
        const isEnabled = await targetDayButton.isEnabled({ timeout: 2000 }).catch(() => false)
        if (isEnabled) {
          dayButton = targetDayButton
          selectedDate = modifiedData.eventDate
        }
      }
      
      // Fallback to first available date if target not available or not enabled
      if (!dayButton) {
        const availableCount = await availableDayButtons.count()
        if (availableCount === 0) {
          throw new Error('No available dates found in calendar for modification - all dates may be booked')
        }
        
        // Find the first actually enabled button
        for (let i = 0; i < Math.min(availableCount, 10); i++) {
          const candidate = availableDayButtons.nth(i)
          await candidate.scrollIntoViewIfNeeded()
          const isEnabled = await candidate.isEnabled({ timeout: 1000 }).catch(() => false)
          if (isEnabled) {
            dayButton = candidate
            break
          }
        }
        
        if (!dayButton) {
          throw new Error('Found available date buttons but none are enabled/clickable')
        }
        
        console.log(`⚠️ Target date ${modifiedData.eventDate} not available or not enabled, selecting first enabled date`)
      }
      
      // Final check and click
      await dayButton.scrollIntoViewIfNeeded()
      await expect(dayButton).toBeVisible({ timeout: 5000 })
      
      // Use force click if normal click fails (for cases where button appears disabled but is actually clickable)
      try {
        await dayButton.click({ timeout: 5000 })
      } catch (error) {
        // If normal click fails, try force click as fallback
        console.log('Normal click failed, trying force click')
        await dayButton.click({ force: true, timeout: 5000 })
      }
      
      // Wait a moment for the date to be selected
      await page.waitForTimeout(500)
    })

    await test.step('Review modification and verify pricing', async () => {
      // Click the "Review Modification" button
      const reviewButton = page.getByTestId('modify-review-button')
      await expect(reviewButton).toBeVisible({ timeout: 10000 })
      await expect(reviewButton).toBeEnabled({ timeout: 15000 })
      
      // Click FIRST, then wait for API responses and Step 2 (prevents "Test ended" errors)
      await reviewButton.click({ timeout: 10000 })
      
      // Wait for modification preview API call and Step 2 to appear
      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/bookings/modify') && resp.request().method() === 'POST',
          { timeout: 20000 }
        ).catch(() => null),
        page.waitForResponse(
          (resp) => resp.url().includes('/api/reservations/modify') && resp.request().method() === 'POST',
          { timeout: 20000 }
        ).catch(() => null),
        expect(page.getByTestId('modify-step2-review-card')).toBeVisible({ timeout: 20000 })
      ])
      
      // Verify we're on Step 2 (Review)
      await expect(page.getByTestId('modify-step2-review-card')).toBeVisible({ timeout: 10000 })
      
      // Verify the preview shows either a refund or payment action
      // The preview should show pricing breakdown
      const reviewCard = page.getByTestId('modify-step2-review-card')
      await expect(reviewCard).toBeVisible({ timeout: 10000 })
      
      // Check for either refund or payment indication
      // The page shows either:
      // - "Refund: $X.XX" (for refunds) - shown in action display
      // - "Additional Payment:" (for payments) - shown in pricing breakdown
      // - "Step 4: Final Result" with net difference (for reschedules with payment)
      // - "No price change" (for no change)
      // We need to check multiple places since payment info can be in different locations
      const refundText = reviewCard.locator('text=/💰 Refund:|Refund:/i')
      const additionalPaymentText = reviewCard.locator('text=/Additional Payment:/i')
      const toPayText = reviewCard.locator('text=/to pay/i')
      const finalResultText = reviewCard.locator('text=/Step 4: Final Result|Final Result/i')
      const noChangeText = reviewCard.locator('text=/No price change|no refund or payment/i')
      
      // Check for payment indicators - these are more specific and reliable
      const hasRefund = await refundText.isVisible({ timeout: 3000 }).catch(() => false)
      const hasAdditionalPayment = await additionalPaymentText.isVisible({ timeout: 3000 }).catch(() => false)
      const hasToPay = await toPayText.isVisible({ timeout: 3000 }).catch(() => false)
      const hasFinalResult = await finalResultText.isVisible({ timeout: 3000 }).catch(() => false)
      const hasNoChange = await noChangeText.isVisible({ timeout: 3000 }).catch(() => false)
      
      // Payment is required if we see "Additional Payment:" or "to pay" text
      // OR if we see "Final Result" with a positive amount (which indicates payment needed)
      const hasPayment = hasAdditionalPayment || hasToPay || (hasFinalResult && !hasRefund && !hasNoChange)
      
      if (!hasRefund && !hasPayment && !hasNoChange) {
        // Try to find pricing breakdown elements as fallback
        const pricingBreakdown = reviewCard.locator('text=/Pricing Breakdown|Step 1:|Step 2:|Step 3:|Step 4:/i')
        const hasBreakdown = await pricingBreakdown.isVisible({ timeout: 3000 }).catch(() => false)
        
        if (!hasBreakdown) {
          throw new Error('Could not find refund, payment, or pricing breakdown information in modification preview')
        }
        
        // If we found breakdown but couldn't determine payment status, log it
        console.log('✅ Found pricing breakdown in modification preview')
      } else {
        if (hasRefund) {
          console.log('✅ Modification preview shows refund amount')
        } else if (hasPayment) {
          console.log('✅ Modification preview shows additional payment required')
        } else {
          console.log('✅ Modification preview shows no price change')
        }
      }
    })

    await test.step('Confirm modification (with payment if needed)', async () => {
      // Acknowledge refund policy checkbox
      const refundPolicyCheckbox = page.getByTestId('modify-refund-policy-checkbox')
      await expect(refundPolicyCheckbox).toBeVisible({ timeout: 10000 })
      await refundPolicyCheckbox.check()
      
      // Wait for the UI to update after checking the checkbox
      // The CheckoutForm appears conditionally based on preview.action === "payment"
      await page.waitForTimeout(1000)
      
      // Check if payment is required by looking for multiple indicators:
      // 1. The text "Complete payment to confirm booking modification" (appears before CheckoutForm)
      // 2. The CheckoutForm submit button
      // 3. The Stripe iframe (most reliable indicator)
      const paymentInstructionText = page.locator('text=/Complete payment to confirm booking modification/i')
      const submitButton = page.locator('button[type="submit"]:has-text("Pay")').or(
        page.locator('button[data-checkout-form][type="submit"]')
      ).first()
      const stripeIframe = page.locator('iframe[name^="__privateStripeFrame"]')
      
      // Check for payment indicators with longer timeout since CheckoutForm loads asynchronously
      const hasPaymentText = await paymentInstructionText.isVisible({ timeout: 5000 }).catch(() => false)
      const hasSubmitButton = await submitButton.isVisible({ timeout: 5000 }).catch(() => false)
      const hasStripeIframe = await stripeIframe.isVisible({ timeout: 5000 }).catch(() => false)
      
      const requiresPayment = hasPaymentText || hasSubmitButton || hasStripeIframe
      
      // Log payment detection results for debugging
      if (requiresPayment) {
        console.log(`💰 Payment detected: paymentText=${hasPaymentText}, submitButton=${hasSubmitButton}, stripeIframe=${hasStripeIframe}`)
      } else {
        console.log(`✅ No payment required: paymentText=${hasPaymentText}, submitButton=${hasSubmitButton}, stripeIframe=${hasStripeIframe}`)
      }
      
      if (requiresPayment) {
        // Payment is required - complete payment similar to initial booking
        console.log('💰 Payment required for modification, completing payment...')
        
        // Wait for CheckoutForm to load (it creates payment intent)
        await page.waitForResponse(
          (resp) => resp.url().includes('/api/payment/create-intent') && resp.request().method() === 'POST',
          { timeout: 20000 }
        ).catch(() => null)
        
        // Wait for Stripe form to load
        await waitForStripeForm(page, 15000)
        
        // Select Card payment method if available (may already be selected)
        await selectCardPaymentMethod(page, 10000)
        
        // Wait for card input to be available
        const cardInputResult = await waitForCardInput(page, 10000)
        if (!cardInputResult) {
          throw new Error('Could not find card number input in Stripe PaymentElement for modification')
        }
        
        // Fill card details in Stripe iframe
        const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"][src*="elements-inner-payment"]')
        await cardInputResult.input.fill(stripeCard.cardNumber)
        await stripeFrame.locator('input[name="expiry"]').fill(stripeCard.expiry)
        await stripeFrame.locator('input[name="cvc"]').fill(stripeCard.cvc)
        await stripeFrame.locator('input[name="postalCode"]').fill(stripeCard.zipCode)
        
        // Submit payment - re-find the button to ensure it's available after form is filled
        // Use the same pattern as booking workflow
        const paymentSubmitButton = page.locator('button[type="submit"]:has-text("Pay")').or(
          page.locator('button[data-checkout-form][type="submit"]')
        ).first()
        await expect(paymentSubmitButton).toBeEnabled({ timeout: 10000 })
        await paymentSubmitButton.click({ timeout: 10000 })
        
        // Wait for payment to process and navigation to bookings page with success parameter
        // The CheckoutForm's onSuccess callback will trigger handleConfirmModification
        await page.waitForURL(/\/bookings\?modifySuccess=true/, { timeout: 30000 })
      } else {
        // No payment required - just confirm the modification
        console.log('✅ No payment required, confirming modification...')
        
        const confirmButton = page.getByTestId('modify-confirm-button')
        await expect(confirmButton).toBeVisible({ timeout: 10000 })
        await expect(confirmButton).toBeEnabled({ timeout: 10000 })
        
        // Click FIRST, then wait for navigation (prevents "Test ended" errors)
        await confirmButton.click({ timeout: 10000 })
        
        // Wait for navigation to bookings page with success parameter
        await page.waitForURL(/\/bookings\?modifySuccess=true/, { timeout: 30000 })
      }
      
      // Verify success message appears
      await expect(page.locator('text=/Booking successfully modified!/i')).toBeVisible({ timeout: 10000 })
      
      console.log('✅ Booking modification completed successfully')
    })

    // ============================================
    // STEP 3: REFUND AND CANCEL BOOKING FROM ADMIN
    // ============================================
    await test.step('Navigate to admin booking detail page', async () => {
      // Navigate to admin bookings page
      await page.goto('/admin/bookings')
      await page.waitForLoadState('networkidle', { timeout: 15000 })
      
      // Wait for bookings to load
      await expect(page.locator('h2:has-text("Bookings")')).toBeVisible({ timeout: 10000 })
      
      // Find the booking by booking number and click "View Details"
      // Admin page shows "Booking #{booking.id.slice(0, 8)} - {track.name}" format
      const bookingHeading = page.locator('h3').filter({ hasText: new RegExp(`Booking #${bookingNumber}`) })
      await expect(bookingHeading).toBeVisible({ timeout: 10000 })
      
      // Find the card container
      const bookingCard = page.locator('div[class*="space-y-4"] > div').filter({
        has: bookingHeading
      }).first()
      
      // Find and click the "View Details" button
      const viewDetailsButton = bookingCard.locator('a[href*="/admin/bookings/"]').or(
        bookingCard.locator('button:has-text("View Details")')
      ).first()
      
      await expect(viewDetailsButton).toBeVisible({ timeout: 10000 })
      await expect(viewDetailsButton).toBeEnabled({ timeout: 10000 })
      
      // Click FIRST, then wait for navigation (prevents "Test ended" errors)
      await viewDetailsButton.click({ timeout: 10000 })
      
      // Wait for navigation to booking detail page
      await page.waitForURL(/\/admin\/bookings\/[^\/]+$/, { timeout: 15000 })
      
      // Verify we're on the booking detail page
      await expect(page.locator(`h2:has-text("Booking #${bookingNumber}")`)).toBeVisible({ timeout: 10000 })
    })

    await test.step('Process full refund from admin console', async () => {
      // Find and click the "Process Refund" button
      const processRefundButton = page.locator('button:has-text("💰 Process Refund")')
      await expect(processRefundButton).toBeVisible({ timeout: 10000 })
      await expect(processRefundButton).toBeEnabled({ timeout: 10000 })
      
      // Click FIRST, then wait for dialog to open (prevents "Test ended" errors)
      await processRefundButton.click({ timeout: 10000 })
      
      // Wait for refund dialog to appear
      await expect(page.getByRole('heading', { name: 'Process Refund' })).toBeVisible({ timeout: 10000 })
      await expect(page.locator('text=/Process a full or partial refund/i')).toBeVisible({ timeout: 10000 })
      
      // Wait for refund breakdown to load (if available)
      await page.waitForTimeout(1000)
      
      // Check if selective refund is available (rescheduling penalty detected)
      const selectiveRefundCheckbox = page.locator('input[type="checkbox"][id="selectiveRefund"]')
      const selectiveRefundNotice = page.locator('text=/Rescheduling Penalty Detected/i')
      const hasSelectiveRefund = await selectiveRefundNotice.isVisible({ timeout: 2000 }).catch(() => false)
      
      // Check if admin override is needed for full refund
      // Look for the admin override checkbox and policy restriction notice
      const adminOverrideCheckbox = page.locator('input[type="checkbox"][id="adminOverride"]')
      const policyRestrictionNotice = page.locator('text=/Policy Restriction in Effect/i')
      const hasPolicyRestriction = await policyRestrictionNotice.isVisible({ timeout: 2000 }).catch(() => false)
      
      // Enable admin override for full refund
      if (await adminOverrideCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('⚠️ Enabling admin override for full refund')
        await adminOverrideCheckbox.check()
        // Wait for form to update
        await page.waitForTimeout(500)
      }
      
      // If selective refund is available, enable it to refund rescheduling penalties
      if (hasSelectiveRefund && await selectiveRefundCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('🎯 Selective refund available, enabling to refund rescheduling penalties')
        await selectiveRefundCheckbox.check()
        // Wait for form to update
        await page.waitForTimeout(500)
      }
      
      // Click "Full Refund" button to set refund type
      // Check for selective refund button first, then override, then regular
      const fullRefundButton = page.locator('button:has-text("💯 Full Refund (Selective")').or(
        page.locator('button:has-text("💯 Full Refund (Override)")')
      ).or(
        page.locator('button:has-text("Full Refund")')
      ).first()
      await expect(fullRefundButton).toBeVisible({ timeout: 10000 })
      await fullRefundButton.click({ timeout: 10000 })
      
      // Fill in required fields
      // Cancellation circumstances
      const circumstancesInput = page.locator('textarea[id="circumstances"]')
      await expect(circumstancesInput).toBeVisible({ timeout: 10000 })
      await circumstancesInput.fill('E2E test cancellation - full refund test')
      
      // Refund reason
      const reasonInput = page.locator('textarea[id="reason"]')
      await expect(reasonInput).toBeVisible({ timeout: 10000 })
      await reasonInput.fill('E2E test - testing full refund flow with selective refund')
      
      // Admin notes
      const notesInput = page.locator('textarea[id="notes"]')
      await expect(notesInput).toBeVisible({ timeout: 10000 })
      await notesInput.fill('E2E test: Processing full refund to complete booking lifecycle test. Using selective refund to include rescheduling penalties.')
      
      // Set up dialog handler to accept all dialogs (confirm and alert)
      // The component uses confirm() before processing and alert() after success
      page.on('dialog', async dialog => {
        await dialog.accept()
      })
      
      // Submit the refund
      const submitRefundButton = page.locator('button:has-text("Process Refund")').filter({
        hasNot: page.locator('text=/Processing/i')
      }).last()
      await expect(submitRefundButton).toBeVisible({ timeout: 10000 })
      await expect(submitRefundButton).toBeEnabled({ timeout: 10000 })
      
      // Click FIRST, then wait for API response and page reload (prevents "Test ended" errors)
      await submitRefundButton.click({ timeout: 10000 })
      
      // Wait for refund API call to complete
      await page.waitForResponse(
        (resp) => resp.url().includes(`/api/admin/bookings/${bookingId}/refund`) && resp.request().method() === 'POST',
        { timeout: 20000 }
      ).catch(() => null)
      
      // Wait for alert dialog to appear and be dismissed, then page reload
      // The component calls alert() then window.location.reload()
      await page.waitForTimeout(1000) // Give time for alert to appear
      await page.waitForLoadState('networkidle', { timeout: 15000 })
      
      // Verify refund was processed - check for success indicators
      // The page should reload and show updated booking status
      await expect(page.locator(`h2:has-text("Booking #${bookingNumber}")`)).toBeVisible({ timeout: 10000 })
    })

    await test.step('Verify booking is cancelled after full refund', async () => {
      // Verify booking status shows CANCELLED
      // The status badge should be visible with CANCELLED text
      const statusBadge = page.locator('span, div').filter({ hasText: /^CANCELLED$/i })
      await expect(statusBadge.first()).toBeVisible({ timeout: 10000 })
      
      // Also verify on the admin bookings list page
      await page.goto('/admin/bookings')
      await page.waitForLoadState('networkidle', { timeout: 15000 })
      
      // Find the booking by booking number
      const bookingHeading = page.locator('h3').filter({ hasText: new RegExp(`Booking #${bookingNumber}`) })
      await expect(bookingHeading).toBeVisible({ timeout: 10000 })
      
      // Find the card container
      const bookingCard = page.locator('div[class*="space-y-4"] > div').filter({
        has: bookingHeading
      }).first()
      
      // Verify status shows CANCELLED
      const statusBadgeInList = bookingCard.locator('span, div').filter({ hasText: /^CANCELLED$/i })
      await expect(statusBadgeInList.first()).toBeVisible({ timeout: 10000 })
      
      console.log('✅ Booking successfully refunded and cancelled')
    })
  })
})
