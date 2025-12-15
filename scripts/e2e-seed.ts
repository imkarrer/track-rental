import { TrackCategory, CarCategory } from "@prisma/client"
import bcrypt from "bcryptjs"
import { normalizeEmail } from "../lib/auth/email-normalize"
import { config } from "dotenv"
import { resolve } from "path"
import { createPrismaClient } from "./prisma-client"

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const prisma = createPrismaClient()

/**
 * Check if we're running in CI environment
 */
function isCI(): boolean {
  return process.env.CI === 'true' || process.env.E2E_CI === 'true'
}

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

/**
 * Seed tracks for E2E tests
 * Creates a few basic tracks that tests can select from
 */
async function seedTracksForE2E() {
  console.log('🏁 Seeding tracks for E2E tests...')
  
  const tracks = [
    {
      name: 'Pro Road Circuit',
      description: 'Professional-grade asphalt track perfect for high-speed RC car racing.',
      category: 'ROAD' as TrackCategory,
      length: 50,
      width: 30,
      minSpaceLength: 55,
      minSpaceWidth: 35,
      unitCost: 2500,
      basePrice: 299,
      setupTimeMinutes: 60,
    },
    {
      name: 'Off-Road Adventure Track',
      description: 'Challenging dirt track with jumps and obstacles.',
      category: 'OFFROAD' as TrackCategory,
      length: 45,
      width: 28,
      minSpaceLength: 50,
      minSpaceWidth: 33,
      unitCost: 3000,
      basePrice: 349,
      setupTimeMinutes: 90,
    },
  ]
  
  const createdTracks = []
  
  for (const trackData of tracks) {
    const existing = await prisma.track.findFirst({
      where: { name: trackData.name },
    })
    
    if (existing) {
      console.log(`   ⏭️  Track "${trackData.name}" already exists`)
      createdTracks.push(existing)
      continue
    }
    
    const track = await prisma.track.create({
      data: {
        ...trackData,
        includedCarIds: [], // Will be updated after cars are created
        imageUrls: [],
        isActive: true,
        testOnly: false, // Visible to tests
      },
    })
    
    console.log(`   ✅ Created track: ${trackData.name}`)
    createdTracks.push(track)
  }
  
  return createdTracks
}

/**
 * Seed cars for E2E tests
 * Creates cars that match the tracks
 */
async function seedCarsForE2E() {
  console.log('🏎️  Seeding cars for E2E tests...')
  
  const cars = [
    {
      name: 'Lightning Road Racer',
      description: '1/10 scale high-speed on-road RC car.',
      category: 'ROAD' as CarCategory,
      type: '1/10 scale',
      unitCost: 250,
      basePricePerDay: 25,
      stockQuantity: 8,
    },
    {
      name: 'Thunder Road Pro',
      description: 'Professional 1/10 scale touring car.',
      category: 'ROAD' as CarCategory,
      type: '1/10 scale',
      unitCost: 350,
      basePricePerDay: 35,
      stockQuantity: 6,
    },
    {
      name: 'Dirt Devil Buggy',
      description: '1/10 scale off-road buggy with 4WD.',
      category: 'OFFROAD' as CarCategory,
      type: '1/10 scale',
      unitCost: 300,
      basePricePerDay: 30,
      stockQuantity: 10,
    },
    {
      name: 'Monster Truck Max',
      description: 'Massive 1/8 scale monster truck.',
      category: 'OFFROAD' as CarCategory,
      type: '1/8 scale',
      unitCost: 400,
      basePricePerDay: 40,
      stockQuantity: 5,
    },
  ]
  
  const createdCars = []
  
  for (const carData of cars) {
    const existing = await prisma.car.findFirst({
      where: { name: carData.name },
    })
    
    if (existing) {
      console.log(`   ⏭️  Car "${carData.name}" already exists`)
      createdCars.push(existing)
      continue
    }
    
    const car = await prisma.car.create({
      data: {
        ...carData,
        imageUrls: [],
        isActive: true,
      },
    })
    
    console.log(`   ✅ Created car: ${carData.name}`)
    createdCars.push(car)
  }
  
  return createdCars
}

/**
 * Update tracks with included car IDs
 */
async function updateTracksWithCars(tracks: any[], cars: any[]) {
  console.log('🔗 Linking tracks with included cars...')
  
  for (const track of tracks) {
    // Filter cars by category matching track
    const matchingCars = cars.filter(car => car.category === track.category)
    
    if (matchingCars.length >= 2) {
      // Select first 2 cars
      const includedCarIds = [matchingCars[0].id, matchingCars[1].id]
      
      await prisma.track.update({
        where: { id: track.id },
        data: { includedCarIds },
      })
      
      console.log(`   ✅ Updated "${track.name}" with 2 included cars`)
    }
  }
}

/**
 * Seed essential configuration data for E2E tests
 */
async function seedEssentialConfig() {
  console.log('⚙️  Seeding essential configuration...')
  
  // Seed day multipliers
  const days = [
    { dayOfWeek: 0, multiplier: 1.3, dayName: 'Sunday' },
    { dayOfWeek: 1, multiplier: 1.0, dayName: 'Monday' },
    { dayOfWeek: 2, multiplier: 1.0, dayName: 'Tuesday' },
    { dayOfWeek: 3, multiplier: 1.0, dayName: 'Wednesday' },
    { dayOfWeek: 4, multiplier: 1.1, dayName: 'Thursday' },
    { dayOfWeek: 5, multiplier: 1.2, dayName: 'Friday' },
    { dayOfWeek: 6, multiplier: 1.4, dayName: 'Saturday' },
  ]
  
  for (const day of days) {
    const existing = await prisma.dayMultiplier.findUnique({
      where: { dayOfWeek: day.dayOfWeek },
    })
    
    if (!existing) {
      await prisma.dayMultiplier.create({
        data: { 
          dayOfWeek: day.dayOfWeek, 
          multiplier: day.multiplier,
          dayName: day.dayName,
        },
      })
      console.log(`   ✅ Created multiplier for ${day.dayName}`)
    }
  }
  
  // Seed pricing config
  const configs = [
    { key: 'tax_rate', value: 0.0725 },
    { key: 'base_distance_miles', value: 20 },
    { key: 'per_mile_charge', value: 2.5 },
  ]
  
  for (const config of configs) {
    const existing = await prisma.pricingConfig.findUnique({
      where: { configKey: config.key },
    })
    
    if (!existing) {
      await prisma.pricingConfig.create({
        data: {
          configKey: config.key,
          configValue: config.value,
          description: `${config.key} configuration`,
        },
      })
      console.log(`   ✅ Created config: ${config.key}`)
    }
  }
  
  // Seed refund policies
  const policies = [
    { daysBeforeService: 30, nonRefundablePercent: 10 },
    { daysBeforeService: 14, nonRefundablePercent: 25 },
    { daysBeforeService: 7, nonRefundablePercent: 50 },
    { daysBeforeService: 3, nonRefundablePercent: 75 },
    { daysBeforeService: 0, nonRefundablePercent: 100 },
  ]
  
  for (const policy of policies) {
    const existing = await prisma.refundPolicy.findUnique({
      where: { daysBeforeService: policy.daysBeforeService },
    })
    
    if (!existing) {
      await prisma.refundPolicy.create({
        data: {
          ...policy,
          description: `${policy.daysBeforeService}+ days: ${policy.nonRefundablePercent}% non-refundable`,
        },
      })
      console.log(`   ✅ Created refund policy: ${policy.daysBeforeService} days`)
    }
  }
}

async function main() {
  try {
    await seedE2ETestUser()
    console.log('')
    
    // In CI environments, always seed tracks and cars for tests
    // In production/preview environments, only seed if CREATE_TEST_TRACK is set
    if (isCI() || process.env.SEED_E2E_DATA === 'true') {
      console.log('🌱 Seeding E2E test data (tracks, cars, config)...')
      console.log('')
      
      const tracks = await seedTracksForE2E()
      console.log('')
      
      const cars = await seedCarsForE2E()
      console.log('')
      
      await updateTracksWithCars(tracks, cars)
      console.log('')
      
      await seedEssentialConfig()
      console.log('')
      
      console.log(`✅ Seeded ${tracks.length} tracks and ${cars.length} cars for E2E tests`)
      console.log('')
    }
    
    // Optionally create a test-only track for production testing
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
