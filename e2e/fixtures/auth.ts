import { test as base, expect, type Page, type Response, type Cookie } from '@playwright/test'

/**
 * Authentication fixture that provides logged-in page context
 * This ensures tests start with an authenticated session
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }: { page: Page }, use: (page: Page) => Promise<void>) => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000'
    // Reduce flaky step timeouts; default Playwright action timeout is 30s
    page.setDefaultTimeout(45000)
    page.setDefaultNavigationTimeout(45000)
    
    // Get test credentials from environment variables
    const email = process.env.TEST_USER_EMAIL || 'test@example.com'
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123'
    
    console.log('🔐 Starting authentication process...')
    console.log(`   Email: ${email}`)
    console.log(`   Base URL: ${baseURL}`)
    
    // Navigate to login page
    await page.goto(`${baseURL}/auth/login`)
    console.log('✅ Navigated to login page')
    
    // Check cookies before login
    const cookiesBeforeLogin = await page.context().cookies()
    console.log(`📦 Cookies before login: ${cookiesBeforeLogin.length}`)
    cookiesBeforeLogin.forEach((cookie: Cookie) => {
      console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 20)}...`)
    })
    
    // Wait for login form to be visible
    await page.waitForSelector('input[id="email"]', { timeout: 10000 })
    
    // CRITICAL: Wait for React to hydrate - form will have data-hydrated="true" when ready
    await page.waitForSelector('form[data-hydrated="true"]', { timeout: 10000 })
    
    // Fill in login form by typing (triggers React onChange)
    await page.locator('input[id="email"]').clear()
    await page.locator('input[id="email"]').pressSequentially(email, { delay: 50 })
    await page.locator('input[id="password"]').clear()
    await page.locator('input[id="password"]').pressSequentially(password, { delay: 50 })
    console.log('✅ Filled in credentials via typing')
    
    // Verify the values were entered
    const emailValue = await page.inputValue('input[id="email"]')
    const passwordValue = await page.inputValue('input[id="password"]')

    
    // Submit login and wait for navigation
    console.log('⏳ Submitting login form...')
    
    // IMPORTANT: We need to call NextAuth's signIn() function, not just submit the form!
    // The form's onSubmit calls signIn() which handles CSRF tokens properly
    // So we must ensure React's handler is called, not native form submission
    
    // Set up network request listener to see the Set-Cookie headers
    const loginResponses: any[] = []
    page.on('response', async (response: Response) => {
      if (response.url().includes('/api/auth/')) {
        const headers = response.headers()
        let body = 'N/A'
        try {
          // Try to get response body for auth callback
          if (response.url().includes('/callback/credentials') || response.url().includes('csrf')) {
            body = await response.text()
          }
        } catch (e) {
          body = 'Could not read body'
        }
        loginResponses.push({
          url: response.url(),
          status: response.status(),
          setCookie: headers['set-cookie'] || 'NO SET-COOKIE HEADER',
          body: body
        })
      }
    })
    
    // Instead of clicking the button, trigger the form submission through React
    // This ensures the onSubmit handler (which calls signIn()) is executed
    const sessionResolved = page.waitForResponse(
      (resp: Response) => resp.url().includes('/api/auth/session') && resp.status() === 200,
      { timeout: 20000 }
    ).catch(() => null)
    const navigatedAwayFromLogin = page.waitForURL(
      (url: URL) => !url.pathname.startsWith('/auth/login'),
      { timeout: 20000 }
    ).catch(() => console.log('   ⚠️ Still on login after submit'))

    await Promise.all([
      sessionResolved,
      navigatedAwayFromLogin,
      // Press Enter in the password field to trigger form submission via React
      page.locator('input[id="password"]').press('Enter')
    ])
    
    console.log(`✅ Form submitted. Current URL: ${page.url()}`)
    
    // After login, NextAuth redirects to home page
    // Wait for session to fully load - check that authenticated elements appear
    // This replaces the hardcoded waits with actual condition checking
    try {
      await page.waitForSelector('a[href="/bookings"]', { timeout: 15000 })
      console.log('✅ Authentication successful - found My Bookings link')
    } catch (error) {
      const pageContent = await page.content()
      console.log('❌ Failed to find authenticated element')
      console.log(`   Current URL: ${page.url()}`)
      console.log(`   Page contains "Sign in": ${pageContent.includes('Sign in')}`)
      console.log(`   Page contains "Sign In": ${pageContent.includes('Sign In')}`)
      console.log(`   Page contains "Loading": ${pageContent.includes('Loading')}`)
      
      // If we're still on login, try refreshing the page once to get the session
      if (page.url().includes('/auth/login')) {
        console.log('⚠️  Still on login page, attempting page refresh...')
        await page.reload({ waitUntil: 'domcontentloaded' })
        
        // Check again after refresh
        if (await page.locator('a[href="/bookings"]').isVisible({ timeout: 5000 })) {
          console.log('✅ Authentication successful after refresh - found My Bookings link')
        } else {
          console.log('⚠️  ERROR: Still redirected to login page - authentication failed!')
          console.log('   This usually means:')
          console.log('   1. Invalid credentials')
          console.log('   2. User not found in database')
          console.log('   3. User email not verified')
          console.log('   4. NEXTAUTH_URL not set to http://localhost:3000 in .env.local')
          console.log('   5. Session cookie not being set properly')
          
          // Save a screenshot for debugging
          await page.screenshot({ path: 'auth-failure.png', fullPage: true })
          console.log('📸 Saved screenshot to auth-failure.png')
          
          throw error
        }
      } else {
        // We're not on login page but still can't find authenticated elements
        console.log('⚠️  Not on login page but missing authenticated elements')
        
        // Save a screenshot for debugging
        await page.screenshot({ path: 'auth-failure.png', fullPage: true })
        console.log('📸 Saved screenshot to auth-failure.png')
        
        throw error
      }
    }
    
    // Ensure global nav/session loading indicator is gone before handing control to tests
    const navLoading = page.getByTestId('nav-loading')
    if (await navLoading.isVisible().catch(() => false)) {
      await navLoading.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null)
    }
    
    // Session is now fully loaded and ready
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page)
  },
})

export { expect }
