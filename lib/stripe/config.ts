import "server-only"
import Stripe from "stripe"

// Initialize Stripe with API key from environment variables
// Use Stripe Mock for local development if STRIPE_SECRET_KEY is not set
const getStripeSecretKey = () => {
  // Remove quotes if present (sometimes .env files have quoted values)
  const secretKey = process.env.STRIPE_SECRET_KEY?.replace(/^["']|["']$/g, '')
  if (secretKey) {
    return secretKey
  }
  
  // For local development with Stripe Mock
  // Stripe Mock accepts any test key, but the Stripe SDK validates the format
  // Use a properly formatted test key (starts with sk_test_ and has proper length)
  if (process.env.NODE_ENV === "development") {
    // Use a properly formatted test key that both Stripe SDK and Mock will accept
    // Format: sk_test_ followed by 24+ alphanumeric characters
    return process.env.STRIPE_TEST_KEY || "sk_test_51abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
  }
  
  // During build time or CI, allow build to proceed without throwing
  // The actual Stripe calls will only happen at runtime, where we can properly validate
  // Check for build context: CI environment, Next.js build phase, or Vercel build
  const isBuildTime = process.env.CI === "true" || 
                      process.env.NEXT_PHASE === "phase-production-build" || 
                      process.env.NEXT_PHASE === "phase-development-build" ||
                      process.env.VERCEL === "1" ||
                      process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined
  
  if (isBuildTime) {
    // Return a dummy key for build time - actual usage will fail at runtime if not configured
    return process.env.STRIPE_TEST_KEY || "sk_test_51abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
  }
  
  throw new Error("STRIPE_SECRET_KEY is required in production")
}

// Check if we should use Stripe Mock
// IMPORTANT: Since client-side Stripe.js requires real keys, we should use real Stripe for server-side too
// Only use Stripe Mock if explicitly enabled AND we're using fake keys (for testing server-side only)
// For normal development with real keys, disable Stripe Mock
const hasRealStripeKey = process.env.STRIPE_SECRET_KEY && 
                         process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") &&
                         !process.env.STRIPE_SECRET_KEY.includes("51abc123def456ghi789jkl012mno345pqr678stu901vwx234yz") &&
                         process.env.STRIPE_SECRET_KEY.length > 80 // Real keys are much longer

const useStripeMock = process.env.NODE_ENV === "development" && 
                      process.env.USE_STRIPE_MOCK === "true" &&
                      !hasRealStripeKey // Don't use mock if we have real keys

// Create custom HTTP client for Stripe Mock
// The Stripe SDK's createFetchHttpClient expects a fetch function with a specific signature
const createMockHttpClient = () => {
  if (!useStripeMock) {
    return undefined
  }

  // Create a custom fetch that proxies to Stripe Mock
  // The fetch function signature must match what Stripe expects
  const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: string
    if (typeof input === "string") {
      url = input
    } else if (input instanceof URL) {
      url = input.toString()
    } else {
      url = input.url
    }
    
    const mockUrl = url.replace(/https?:\/\/api\.stripe\.com/g, "http://localhost:12111")
    console.log(`[Stripe Mock] Proxying: ${url} -> ${mockUrl}`)
    
    // Use global fetch (Node 18+ has built-in fetch)
    return fetch(mockUrl, init)
  }

  try {
    // Stripe.createFetchHttpClient expects the fetch function directly, not an object
    return Stripe.createFetchHttpClient(mockFetch)
  } catch (error) {
    console.error("Failed to create custom HTTP client:", error)
    return undefined
  }
}

const stripeConfig: Stripe.StripeConfig = {
  apiVersion: "2025-11-17.clover",
}

// Only add custom HTTP client if using mock
const mockHttpClient = createMockHttpClient()
if (mockHttpClient) {
  stripeConfig.httpClient = mockHttpClient
}

export const stripe = new Stripe(getStripeSecretKey(), stripeConfig)

