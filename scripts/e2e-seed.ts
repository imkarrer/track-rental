import { PrismaClient, TrackCategory, CarCategory } from "@prisma/client"
import bcrypt from "bcryptjs"
import { normalizeEmail } from "../lib/auth/email-normalize"
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()

/**
 * E2E Test Seeding Script
 * 
 * This script ensures a test admin user exists for E2E tests.
 * It's idempotent - safe to run multiple times.
 * 
 * In local/CI environments, it uses environment variables.
 * In production, the test user should already exist with proper credentials
 * stored in GitHub secrets.
 */
async function seedE2ETestUser() {
  // Get test credentials from environment
  const email = process.env.TEST_USER_EMAIL || 'test@example.com'
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123'
  const firstName = process.env.TEST_USER_FIRST_NAME || 'Test'
  const lastName = process.env.TEST_USER_LAST_NAME || 'Admin'

  console.log('🌱 Seeding E2E test user...')
  console.log(`   Email: ${email}`)

  // Normalize email
  const norm = normalizeEmail(email)

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { emailCanonical: norm.canonical },
  })

  if (existingUser) {
    // Update existing user to ensure it has admin role and correct password
    const passwordHash = await bcrypt.hash(password, 10)
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        role: "ADMIN",
        firstName,
        lastName,
        emailVerified: new Date(), // Auto-verify test users
      },
    })
    console.log(`✅ Test user already exists - updated to ensure admin role`)
    console.log(`   User ID: ${updatedUser.id}`)
    console.log(`   Role: ${updatedUser.role}`)
    console.log(`   Email verified: Yes`)
  } else {
    // Create new test admin user
    const passwordHash = await bcrypt.hash(password, 10)
    const newUser = await prisma.user.create({
      data: {
        email: norm.original.toLowerCase(),
        emailCanonical: norm.canonical,
        passwordHash,
        firstName,
        lastName,
        role: "ADMIN",
        emailVerified: new Date(), // Auto-verify test users
      },
    })
    console.log(`✅ Created new test ADMIN user: ${norm.original}`)
    console.log(`   User ID: ${newUser.id}`)
    console.log(`   Role: ${newUser.role}`)
    console.log(`   Email verified: Yes`)
  }

  console.log('')
}

/**
 * Seed a test-only track for production e2e testing
 * 
 * This creates a hidden track (testOnly=true) that can be used
 * for e2e tests in production with real Stripe payments.
 * 
 * Set TEST_TRACK_NAME and TEST_TRACK_BASE_PRICE environment variables
 * to customize the test track.
 */
async function seedTestTrack(): Promise<string | null> {
  // Only create test track if explicitly requested
  const createTestTrack = process.env.CREATE_TEST_TRACK === 'true'
  
  if (!createTestTrack) {
    console.log('🏁 Skipping test track creation (set CREATE_TEST_TRACK=true to enable)')
    return null
  }

  const trackName = process.env.TEST_TRACK_NAME || 'E2E Test Track (Hidden)'
  const basePrice = parseFloat(process.env.TEST_TRACK_BASE_PRICE || '1.00')
  const category: TrackCategory = (process.env.TEST_TRACK_CATEGORY as TrackCategory) || 'ROAD'

  console.log('🏁 Seeding test-only track...')
  console.log(`   Name: ${trackName}`)
  console.log(`   Base Price: $${basePrice.toFixed(2)}`)
  console.log(`   Category: ${category}`)

  // Check if test track already exists
  const existingTrack = await prisma.track.findFirst({
    where: { name: trackName },
  })

  if (existingTrack) {
    console.log(`✅ Test track already exists with ID: ${existingTrack.id}`)
    console.log(`   Set TEST_TRACK_ID=${existingTrack.id} in your e2e environment`)
    return existingTrack.id
  }

  // Find two cars with matching category to include with the track
  const matchingCars = await prisma.car.findMany({
    where: { 
      category: category as CarCategory,
      isActive: true,
    },
    take: 2,
  })

  if (matchingCars.length < 2) {
    console.log(`⚠️  Warning: Found only ${matchingCars.length} ${category} cars. Need 2 to create track.`)
    console.log('   Please create cars first using seed-dev-data.ts')
    return null
  }

  const includedCarIds = matchingCars.map(car => car.id)

  // Create the test-only track
  const track = await prisma.track.create({
    data: {
      name: trackName,
      description: 'Hidden track for e2e testing with real payments. Not visible to public users.',
      category,
      length: 30,
      width: 20,
      minSpaceLength: 35,
      minSpaceWidth: 25,
      unitCost: 100, // Minimal unit cost
      includedCarIds,
      basePrice,
      setupTimeMinutes: 30,
      imageUrls: [],
      isActive: true,
      testOnly: true, // IMPORTANT: This hides the track from public users
    },
  })

  console.log(`✅ Created test-only track: ${track.name}`)
  console.log(`   Track ID: ${track.id}`)
  console.log(`   Base Price: $${Number(track.basePrice).toFixed(2)}`)
  console.log(`   Test Only: ${track.testOnly}`)
  console.log('')
  console.log('📋 Add this to your e2e environment variables:')
  console.log(`   TEST_TRACK_ID=${track.id}`)
  console.log('')

  return track.id
}

async function main() {
  try {
    await seedE2ETestUser()
    console.log('')
    
    const testTrackId = await seedTestTrack()
    
    console.log('')
    console.log('✅ E2E test seeding complete!')
    
    if (testTrackId) {
      console.log('')
      console.log('🔧 For production e2e tests, set:')
      console.log(`   TEST_TRACK_ID=${testTrackId}`)
    }
  } catch (error) {
    console.error('❌ E2E test seeding failed:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
