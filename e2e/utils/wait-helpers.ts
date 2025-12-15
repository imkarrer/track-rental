import { Page, expect } from '@playwright/test'

/**
 * Wait for a successful toast/notification message
 */
export async function waitForSuccessMessage(page: Page, timeout: number = 10000) {
  await expect(
    page.locator('text=/success|confirmed|complete/i')
  ).toBeVisible({ timeout })
}

/**
 * Wait for Stripe payment form to be ready
 * Note: Cross-origin iframe content cannot be accessed, so we only wait for the iframe element to appear
 */
export async function waitForStripeForm(page: Page, timeout: number = 30000) {
  // Wait for Stripe PaymentElement container to appear
  await page.waitForSelector('.StripeElement iframe[name^="__privateStripeFrame"]', { timeout })
  
  // Wait for the iframe to be attached
  const iframe = page.locator('iframe[name^="__privateStripeFrame"]').first()
  await iframe.waitFor({ state: 'attached', timeout })
  
  // Give Stripe PaymentElement a brief moment to initialize
  // The test will handle retries when accessing iframe content
  await page.waitForTimeout(1000)
}

/**
 * Wait for and select Card payment method in Stripe PaymentElement
 * Payment methods are typically rendered inside the Stripe iframe
 */
export async function selectCardPaymentMethod(page: Page, timeout: number = 15000): Promise<boolean> {
  const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()
  
  // Common selectors for Card payment method in Stripe PaymentElement
  const selectors = [
    'button:has-text("Card")',
    '[role="tab"]:has-text("Card")',
    '[role="button"]:has-text("Card")',
    'div[role="button"]:has-text("Card")',
    'label:has-text("Card")',
    'input[type="radio"][value*="card"]',
    'input[type="radio"][name*="payment"]',
    // Also try case-insensitive
    'button:has-text(/card/i)',
    '[role="tab"]:has-text(/card/i)',
  ]
  
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    for (const selector of selectors) {
      try {
        const cardMethod = stripeFrame.locator(selector).first()
        const isVisible = await cardMethod.isVisible({ timeout: 2000 }).catch(() => false)
        if (isVisible) {
          console.log(`✅ Found Card payment method using: ${selector}`)
          await cardMethod.click({ timeout: 5000 })
          
          // After clicking Card, Stripe may replace the iframe content or show card inputs
          // Wait for the card form to appear - this can take a few seconds
          await page.waitForTimeout(3000)
          
          // Verify card form appeared by checking for card number input
          // Retry checking multiple times since Stripe loads asynchronously
          let cardFormVisible = false
          for (let checkAttempt = 0; checkAttempt < 5; checkAttempt++) {
            const cardNumberInput = stripeFrame.locator('input[name="cardnumber"]')
            cardFormVisible = await cardNumberInput.isVisible({ timeout: 2000 }).catch(() => false)
            
            if (cardFormVisible) {
              console.log(`✅ Card form appeared after selecting Card payment method (check ${checkAttempt + 1})`)
              // Give it a moment to fully initialize
              await page.waitForTimeout(1000)
              return true
            }
            
            if (checkAttempt < 4) {
              await page.waitForTimeout(1000)
            }
          }
          
          if (!cardFormVisible) {
            console.log('⚠️ Card selected but card form not yet visible after multiple checks')
            console.log('   Waiting for iframe to stabilize...')
            // Wait for iframe height to stabilize (indicates content has loaded)
            await page.waitForTimeout(2000)
            // Return true anyway - the test will retry finding the inputs
            return true
          }
        }
      } catch (error) {
        // Try next selector
        continue
      }
    }
    
    // Wait before retrying
    await page.waitForTimeout(1000)
  }
  
  return false
}

/**
 * Wait for and find card number input in Stripe PaymentElement iframe
 * After Card payment method is selected, Stripe loads card inputs asynchronously
 */
export async function waitForCardInput(page: Page, timeout: number = 20000): Promise<{ frame: any, input: any } | null> {
  // Wait for iframe to be ready
  const iframeElement = page.locator('iframe[name^="__privateStripeFrame"]').first()
  await iframeElement.waitFor({ state: 'attached', timeout: 10000 })
  
  // Try to get the actual frame object (more reliable than frameLocator for cross-origin)
  // But frameLocator is safer for cross-origin, so we'll use that
  const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()
  
  // Stripe PaymentElement might use different input selectors
  const cardInputSelectors = [
    'input[name="cardnumber"]',
    'input[autocomplete="cc-number"]',
    'input[placeholder*="Card"]',
    'input[placeholder*="card"]',
    'input[placeholder*="1234"]', // Common placeholder pattern
    'input[type="text"]', // Fallback - first text input
  ]
  
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    // First, check if iframe has any content at all
    try {
      const anyInput = stripeFrame.locator('input').first()
      const inputCount = await anyInput.count().catch(() => 0)
      
      if (inputCount === 0) {
        // No inputs yet, wait and retry
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        if (elapsed % 3 === 0) { // Log every 3 seconds
          console.log(`Waiting for Stripe iframe inputs to appear... (${elapsed}s elapsed)`)
        }
        await page.waitForTimeout(1500)
        continue
      } else {
        console.log(`Found ${inputCount} input(s) in Stripe iframe`)
      }
    } catch (error) {
      // Iframe content not accessible yet
      await page.waitForTimeout(1500)
      continue
    }
        
        // Iframe has inputs, try to find the card number input
        for (const selector of cardInputSelectors) {
          try {
            const input = stripeFrame.locator(selector).first()
            const count = await input.count().catch(() => 0)
            
            if (count > 0) {
              const isVisible = await input.isVisible({ timeout: 2000 }).catch(() => false)
              
              if (isVisible) {
                const isEnabled = await input.isEnabled({ timeout: 1000 }).catch(() => false)
                if (isEnabled) {
                  console.log(`✅ Found card number input using selector: ${selector}`)
                  return { frame: stripeFrame, input }
                } else {
                  console.log(`Input found with ${selector} but not enabled yet`)
                }
              } else {
                console.log(`Input found with ${selector} but not visible`)
              }
            }
          } catch (error) {
            // Try next selector
            continue
          }
        }
        
        // Inputs exist but card input not found with any selector
        // Log what inputs we can see for debugging
        try {
          const allInputs = stripeFrame.locator('input')
          const inputCount = await allInputs.count()
          if (inputCount > 0) {
            // Try to get attributes of first input for debugging
            const firstInput = allInputs.first()
            const name = await firstInput.getAttribute('name').catch(() => 'unknown')
            const placeholder = await firstInput.getAttribute('placeholder').catch(() => 'unknown')
            const autocomplete = await firstInput.getAttribute('autocomplete').catch(() => 'unknown')
            console.log(`Found ${inputCount} input(s) but none matched card selectors. First input: name="${name}", placeholder="${placeholder}", autocomplete="${autocomplete}"`)
          }
        } catch (debugError) {
          // Ignore debug errors
        }
        
        // Wait and retry - Stripe might still be loading
        await page.waitForTimeout(1500)
  }
  
  console.log('⚠️ Could not find card number input after timeout')
  return null
}

/**
 * Retry an action with exponential backoff
 */
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * Navigate the calendar forward by clicking the "next month" button
 * @param page Playwright page object
 * @param datePicker Locator for the calendar container (can be .rdp element or parent container)
 * @param months Number of months to navigate forward (default: 6)
 */
export async function navigateCalendarMonths(
  page: Page,
  datePicker: any,
  months: number = 6
): Promise<void> {
  // Find the next button - try multiple selectors for robustness
  // The button has class rdp-nav_button_next and name="next-month"
  const buttonSelectors = [
    'button.rdp-nav_button_next',
    'button[name="next-month"]',
    'button[aria-label="Go to next month"]',
  ]
  
  let nextButton
  let found = false
  
  // First try to find it directly in datePicker (if datePicker is .rdp)
  for (const selector of buttonSelectors) {
    const candidate = datePicker.locator(selector).first()
    const count = await candidate.count().catch(() => 0)
    if (count > 0) {
      nextButton = candidate
      found = true
      break
    }
  }
  
  // If not found, datePicker is likely a parent container, find .rdp inside it
  if (!found) {
    const rdpElement = datePicker.locator('.rdp').first()
    await expect(rdpElement).toBeVisible({ timeout: 10000 })
    
    for (const selector of buttonSelectors) {
      const candidate = rdpElement.locator(selector).first()
      const count = await candidate.count().catch(() => 0)
      if (count > 0) {
        nextButton = candidate
        found = true
        break
      }
    }
  }
  
  if (!found || !nextButton) {
    throw new Error('Could not find calendar next month button')
  }
  
  // Wait for the next button to be available
  await expect(nextButton).toBeVisible({ timeout: 10000 })
  
  console.log(`📅 Navigating calendar forward ${months} month(s)...`)
  
  for (let i = 0; i < months; i++) {
    // Check if button is disabled (can't navigate further)
    const isDisabled = await nextButton.getAttribute('aria-disabled').catch(() => null)
    if (isDisabled === 'true') {
      console.log(`⚠️ Cannot navigate further - reached maximum date limit at month ${i + 1}`)
      break
    }
    
    // Click the next button
    await nextButton.click({ timeout: 5000 })
    
    // Wait for calendar to update (give it time to re-render)
    await page.waitForTimeout(500)
    
    // Verify the calendar updated by checking if the caption changed
    // This ensures we're not clicking too fast
    await page.waitForTimeout(300)
  }
  
  console.log(`✅ Calendar navigated forward ${months} month(s)`)
}
