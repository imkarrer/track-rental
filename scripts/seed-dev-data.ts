import { S3Client, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3"
import bcrypt from "bcryptjs"
import { normalizeEmail } from "../lib/auth/email-normalize"
import { config } from "dotenv"
import { resolve } from "path"
import * as fs from "fs"
import * as path from "path"
import { createPrismaClient } from "./prisma-client"

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const prisma = createPrismaClient()

// S3 Client for MinIO
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
  },
  forcePathStyle: true,
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "rc-track-rental"

/**
 * Generate a placeholder image with text
 */
function generatePlaceholderImage(text: string, width: number = 800, height: number = 600): Buffer {
  // Create a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">
        ${text}
      </text>
    </svg>
  `
  return Buffer.from(svg)
}

/**
 * Upload an image to MinIO
 */
async function uploadImage(key: string, buffer: Buffer, contentType: string = "image/svg+xml"): Promise<string> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    )
    
    // Return the public URL
    const publicUrl = `${process.env.S3_ENDPOINT || "http://localhost:9000"}/${BUCKET_NAME}/${key}`
    return publicUrl
  } catch (error) {
    console.error(`Failed to upload image ${key}:`, error)
    throw error
  }
}

/**
 * Check if MinIO bucket exists
 */
async function checkBucket(): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }))
    return true
  } catch (error) {
    return false
  }
}

/**
 * Seed users
 */
async function seedUsers() {
  console.log('👥 Seeding users...')
  
  const users = [
    {
      email: 'admin@example.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN' as const,
      phone: '555-0100',
    },
    {
      email: 'john.doe@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER' as const,
      phone: '555-0101',
    },
    {
      email: 'jane.smith@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'USER' as const,
      phone: '555-0102',
    },
    {
      email: 'bob.wilson@example.com',
      password: 'password123',
      firstName: 'Bob',
      lastName: 'Wilson',
      role: 'USER' as const,
      phone: '555-0103',
    },
  ]
  
  const createdUsers = []
  
  for (const userData of users) {
    const norm = normalizeEmail(userData.email)
    
    const existingUser = await prisma.user.findUnique({
      where: { emailCanonical: norm.canonical },
    })
    
    if (existingUser) {
      console.log(`   ⏭️  User ${userData.email} already exists`)
      createdUsers.push(existingUser)
      continue
    }
    
    const passwordHash = await bcrypt.hash(userData.password, 10)
    
    const user = await prisma.user.create({
      data: {
        email: norm.original.toLowerCase(),
        emailCanonical: norm.canonical,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        emailVerified: new Date(),
      },
    })
    
    console.log(`   ✅ Created ${userData.role} user: ${userData.email}`)
    createdUsers.push(user)
  }
  
  return createdUsers
}

/**
 * Seed addresses for users
 */
async function seedAddresses(users: any[]) {
  console.log('🏠 Seeding addresses...')
  
  const addresses = [
    {
      streetAddress: '123 Main Street',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
    },
    {
      streetAddress: '456 Oak Avenue',
      city: 'San Diego',
      state: 'CA',
      zipCode: '92101',
    },
    {
      streetAddress: '789 Pine Road',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
    },
  ]
  
  // Skip admin user, add addresses for regular users
  const regularUsers = users.filter(u => u.role === 'USER')
  
  for (let i = 0; i < regularUsers.length && i < addresses.length; i++) {
    const user = regularUsers[i]
    const addressData = addresses[i]
    
    const existing = await prisma.address.findFirst({
      where: { userId: user.id },
    })
    
    if (existing) {
      console.log(`   ⏭️  Address for ${user.email} already exists`)
      continue
    }
    
    await prisma.address.create({
      data: {
        userId: user.id,
        ...addressData,
        isBilling: true,
      },
    })
    
    console.log(`   ✅ Created address for ${user.email}`)
  }
}

/**
 * Seed tracks with images
 */
async function seedTracks(uploadImages: boolean = true) {
  console.log('🏁 Seeding tracks...')
  
  const tracks = [
    {
      name: 'Pro Road Circuit',
      description: 'Professional-grade asphalt track perfect for high-speed RC car racing. Features multiple turns and straightaways for exciting competition.',
      category: 'ROAD' as const,
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
      description: 'Challenging dirt track with jumps, bumps, and obstacles. Perfect for off-road RC trucks and buggies.',
      category: 'OFFROAD' as const,
      length: 45,
      width: 28,
      minSpaceLength: 50,
      minSpaceWidth: 33,
      unitCost: 3000,
      basePrice: 349,
      setupTimeMinutes: 90,
    },
    {
      name: 'Beginner Circuit',
      description: 'Easy-to-navigate track perfect for beginners and kids. Smooth surface with gentle curves.',
      category: 'ROAD' as const,
      length: 35,
      width: 20,
      minSpaceLength: 40,
      minSpaceWidth: 25,
      unitCost: 1500,
      basePrice: 199,
      setupTimeMinutes: 45,
    },
    {
      name: 'Extreme Off-Road',
      description: 'Advanced off-road course with steep jumps and technical sections. For experienced drivers only!',
      category: 'OFFROAD' as const,
      length: 60,
      width: 35,
      minSpaceLength: 65,
      minSpaceWidth: 40,
      unitCost: 4000,
      basePrice: 399,
      setupTimeMinutes: 120,
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
    
    // Generate and upload placeholder images
    let imageUrls: string[] = []
    if (uploadImages) {
      for (let i = 1; i <= 3; i++) {
        const imageKey = `tracks/${trackData.name.toLowerCase().replace(/\s+/g, '-')}-${i}.svg`
        const imageBuffer = generatePlaceholderImage(`${trackData.name} - Image ${i}`, 1200, 800)
        const imageUrl = await uploadImage(imageKey, imageBuffer)
        imageUrls.push(imageUrl)
      }
    }
    
    const track = await prisma.track.create({
      data: {
        ...trackData,
        includedCarIds: [], // Will be updated after cars are created
        imageUrls,
        isActive: true,
      },
    })
    
    console.log(`   ✅ Created track: ${trackData.name}`)
    createdTracks.push(track)
  }
  
  return createdTracks
}

/**
 * Seed cars with images
 */
async function seedCars(uploadImages: boolean = true) {
  console.log('🏎️  Seeding cars...')
  
  const cars = [
    {
      name: 'Lightning Road Racer',
      description: '1/10 scale high-speed on-road RC car. Top speed 45mph.',
      category: 'ROAD' as const,
      type: '1/10 scale',
      unitCost: 250,
      basePricePerDay: 25,
      stockQuantity: 8,
    },
    {
      name: 'Thunder Road Pro',
      description: 'Professional 1/10 scale touring car with brushless motor.',
      category: 'ROAD' as const,
      type: '1/10 scale',
      unitCost: 350,
      basePricePerDay: 35,
      stockQuantity: 6,
    },
    {
      name: 'Dirt Devil Buggy',
      description: '1/10 scale off-road buggy with 4WD and oil-filled shocks.',
      category: 'OFFROAD' as const,
      type: '1/10 scale',
      unitCost: 300,
      basePricePerDay: 30,
      stockQuantity: 10,
    },
    {
      name: 'Monster Truck Max',
      description: 'Massive 1/8 scale monster truck with huge tires and suspension.',
      category: 'OFFROAD' as const,
      type: '1/8 scale',
      unitCost: 400,
      basePricePerDay: 40,
      stockQuantity: 5,
    },
    {
      name: 'Speed Demon GT',
      description: '1/8 scale GT racing car with incredible speed and handling.',
      category: 'ROAD' as const,
      type: '1/8 scale',
      unitCost: 450,
      basePricePerDay: 45,
      stockQuantity: 4,
    },
    {
      name: 'Rock Crawler Pro',
      description: 'Specialized rock crawler with extreme articulation for technical terrain.',
      category: 'OFFROAD' as const,
      type: '1/10 scale',
      unitCost: 320,
      basePricePerDay: 32,
      stockQuantity: 6,
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
    
    // Generate and upload placeholder images
    let imageUrls: string[] = []
    if (uploadImages) {
      for (let i = 1; i <= 2; i++) {
        const imageKey = `cars/${carData.name.toLowerCase().replace(/\s+/g, '-')}-${i}.svg`
        const imageBuffer = generatePlaceholderImage(`${carData.name}`, 800, 600)
        const imageUrl = await uploadImage(imageKey, imageBuffer)
        imageUrls.push(imageUrl)
      }
    }
    
    const car = await prisma.car.create({
      data: {
        ...carData,
        imageUrls,
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
      // Randomly select 2 cars
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
 * Seed pricing configuration
 */
async function seedPricingConfig() {
  console.log('💰 Seeding pricing configuration...')
  
  const configs = [
    { key: 'tax_rate', value: 0.0725, description: 'Sales tax rate (7.25%)' },
    { key: 'base_distance_miles', value: 20, description: 'Base distance included (miles)' },
    { key: 'per_mile_charge', value: 2.5, description: 'Charge per mile over base' },
  ]
  
  for (const config of configs) {
    const existing = await prisma.pricingConfig.findUnique({
      where: { configKey: config.key },
    })
    
    if (existing) {
      console.log(`   ⏭️  Config "${config.key}" already exists`)
      continue
    }
    
    await prisma.pricingConfig.create({
      data: {
        configKey: config.key,
        configValue: config.value,
        description: config.description,
      },
    })
    
    console.log(`   ✅ Created config: ${config.key}`)
  }
}

/**
 * Seed day multipliers
 */
async function seedDayMultipliers() {
  console.log('📅 Seeding day multipliers...')
  
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
    
    if (existing) {
      console.log(`   ⏭️  Day multiplier for ${day.dayName} already exists`)
      continue
    }
    
    await prisma.dayMultiplier.create({
      data: day,
    })
    
    console.log(`   ✅ Created multiplier for ${day.dayName}`)
  }
}

/**
 * Seed fixed costs configuration
 */
async function seedFixedCosts() {
  console.log('💵 Seeding fixed costs configuration...')
  
  const existing = await prisma.fixedCostsConfig.findFirst()
  
  if (existing) {
    console.log('   ⏭️  Fixed costs config already exists')
    return
  }
  
  await prisma.fixedCostsConfig.create({
    data: {
      expectedRentals: 60,
      monthlyRentalsTarget: 4,
      laborRatePerHour: 20,
      breakdownTimeHours: 1,
      averageDistanceMiles: 20,
      fuelCostPerMile: 0.5,
      apiEmailCosts: 0.11,
      smsCostPerMessage: 0.01,
      stripeFeeRate: 0.029,
      stripeFixedFee: 0.3,
      serverHostingMonthly: 25,
      databaseMonthly: 12,
      emailServiceMonthly: 10,
      domainMonthly: 1,
      insuranceMonthly: 41.67,
      holidayMultiplier: 1.5,
    },
  })
  
  console.log('   ✅ Created fixed costs configuration')
}

/**
 * Seed holiday rules
 */
async function seedHolidayRules() {
  console.log('🎉 Seeding holiday rules...')
  
  const holidays = [
    {
      id: 'new-years-day',
      name: "New Year's Day",
      description: 'January 1st',
      type: 'fixed',
      month: 1,
      day: 1,
      observedOnMonday: true,
      priceMultiplier: 1.5,
      isFederal: true,
    },
    {
      id: 'independence-day',
      name: 'Independence Day',
      description: 'July 4th',
      type: 'fixed',
      month: 7,
      day: 4,
      observedOnMonday: true,
      observedOnFriday: true,
      priceMultiplier: 1.5,
      isFederal: true,
    },
    {
      id: 'christmas',
      name: 'Christmas Day',
      description: 'December 25th',
      type: 'fixed',
      month: 12,
      day: 25,
      observedOnMonday: true,
      observedOnFriday: true,
      priceMultiplier: 1.5,
      isFederal: true,
    },
    {
      id: 'memorial-day',
      name: 'Memorial Day',
      description: 'Last Monday in May',
      type: 'nth-weekday',
      month: 5,
      weekday: 1,
      week: -1,
      priceMultiplier: 1.5,
      isFederal: true,
    },
    {
      id: 'labor-day',
      name: 'Labor Day',
      description: 'First Monday in September',
      type: 'nth-weekday',
      month: 9,
      weekday: 1,
      week: 1,
      priceMultiplier: 1.5,
      isFederal: true,
    },
  ]
  
  for (const holiday of holidays) {
    const existing = await prisma.holidayRule.findUnique({
      where: { id: holiday.id },
    })
    
    if (existing) {
      console.log(`   ⏭️  Holiday rule "${holiday.name}" already exists`)
      continue
    }
    
    await prisma.holidayRule.create({
      data: holiday,
    })
    
    console.log(`   ✅ Created holiday rule: ${holiday.name}`)
  }
}

/**
 * Seed refund policies
 */
async function seedRefundPolicies() {
  console.log('💸 Seeding refund policies...')
  
  const policies = [
    { daysBeforeService: 30, nonRefundablePercent: 10, description: '30+ days: 10% non-refundable' },
    { daysBeforeService: 14, nonRefundablePercent: 25, description: '14-29 days: 25% non-refundable' },
    { daysBeforeService: 7, nonRefundablePercent: 50, description: '7-13 days: 50% non-refundable' },
    { daysBeforeService: 3, nonRefundablePercent: 75, description: '3-6 days: 75% non-refundable' },
    { daysBeforeService: 0, nonRefundablePercent: 100, description: '0-2 days: 100% non-refundable' },
  ]
  
  for (const policy of policies) {
    const existing = await prisma.refundPolicy.findUnique({
      where: { daysBeforeService: policy.daysBeforeService },
    })
    
    if (existing) {
      console.log(`   ⏭️  Refund policy for ${policy.daysBeforeService} days already exists`)
      continue
    }
    
    await prisma.refundPolicy.create({
      data: policy,
    })
    
    console.log(`   ✅ Created refund policy: ${policy.description}`)
  }
}

/**
 * Seed referral program configuration
 */
async function seedReferralConfig() {
  console.log('🎁 Seeding referral program configuration...')
  
  const configs = [
    {
      id: 'user',
      enabled: true,
      referrerType: 'PERCENT',
      referrerPercentOff: 10,
      referrerApplyOnce: false,
      refereeType: 'PERCENT',
      refereePercentOff: 10,
      refereeApplyOnce: true,
    },
    {
      id: 'admin',
      enabled: true,
      referrerType: 'FLAT',
      referrerAmountOff: 25,
      referrerApplyOnce: true,
      refereeType: 'PERCENT',
      refereePercentOff: 15,
      refereeApplyOnce: true,
    },
  ]
  
  for (const config of configs) {
    const existing = await prisma.referralProgramConfig.findUnique({
      where: { id: config.id },
    })
    
    if (existing) {
      console.log(`   ⏭️  Referral config "${config.id}" already exists`)
      continue
    }
    
    await prisma.referralProgramConfig.create({
      data: config,
    })
    
    console.log(`   ✅ Created referral config: ${config.id}`)
  }
}

/**
 * Seed sample bookings
 */
async function seedBookings(users: any[], tracks: any[], cars: any[]) {
  console.log('📝 Seeding sample bookings...')
  
  // Only create bookings for regular users
  const regularUsers = users.filter(u => u.role === 'USER')
  
  if (regularUsers.length === 0 || tracks.length === 0) {
    console.log('   ⏭️  Skipping bookings (no users or tracks)')
    return
  }
  
  // Create a few sample bookings
  const today = new Date()
  
  // Past completed booking
  const pastDate = new Date(today)
  pastDate.setDate(pastDate.getDate() - 30)
  
  // Upcoming confirmed booking
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + 14)
  
  const bookings = [
    {
      user: regularUsers[0],
      track: tracks[0],
      eventDate: pastDate,
      status: 'COMPLETED' as const,
      daysOffset: -30,
    },
    {
      user: regularUsers[1],
      track: tracks[1],
      eventDate: futureDate,
      status: 'CONFIRMED' as const,
      daysOffset: 14,
    },
  ]
  
  for (const bookingData of bookings) {
    const existing = await prisma.booking.findFirst({
      where: {
        userId: bookingData.user.id,
        trackId: bookingData.track.id,
        eventDate: bookingData.eventDate,
      },
    })
    
    if (existing) {
      console.log(`   ⏭️  Booking for ${bookingData.user.email} already exists`)
      continue
    }
    
    const matchingCars = cars.filter(car => car.category === bookingData.track.category)
    const selectedCars = matchingCars.slice(0, 2).map(car => ({
      carId: car.id,
      quantity: 1,
      isFree: true,
    }))
    
    const basePrice = Number(bookingData.track.basePrice)
    const subtotal = basePrice
    const tax = subtotal * 0.0725
    const total = subtotal + tax
    
    const booking = await prisma.booking.create({
      data: {
        userId: bookingData.user.id,
        trackId: bookingData.track.id,
        eventDate: bookingData.eventDate,
        startTime: '10:00',
        endTime: '16:00',
        durationHours: 6,
        eventAddress: '123 Event Street',
        eventCity: 'Los Angeles',
        eventState: 'CA',
        eventZip: '90001',
        availableSpaceLength: 50,
        availableSpaceWidth: 30,
        distanceFromBase: 15,
        dayOfWeek: bookingData.eventDate.getDay(),
        basePrice,
        dayMultiplier: 1.2,
        durationMultiplier: 1.0,
        distanceSurcharge: 0,
        setupFee: 0,
        freeCarsIncluded: 2,
        additionalCarsCount: 0,
        additionalCarsPrice: 0,
        subtotal,
        tax,
        total,
        status: bookingData.status,
        paymentIntentId: `pi_test_${Math.random().toString(36).substring(7)}`,
        phone: bookingData.user.phone,
        smsOptIn: true,
        emailOptOut: false,
      },
    })
    
    // Create booking cars
    for (const carData of selectedCars) {
      await prisma.bookingCar.create({
        data: {
          bookingId: booking.id,
          carId: carData.carId,
          quantity: carData.quantity,
          isFree: carData.isFree,
          unitPrice: 0,
          totalPrice: 0,
        },
      })
    }
    
    console.log(`   ✅ Created ${bookingData.status} booking for ${bookingData.user.email}`)
  }
}

/**
 * Main seeding function
 */
async function main() {
  console.log('🌱 Starting development data seeding...\n')
  
  try {
    // Check MinIO connection
    console.log('🗄️  Checking MinIO connection...')
    const bucketExists = await checkBucket()
    if (!bucketExists) {
      console.log('   ⚠️  MinIO bucket not found. Run "npm run storage:init" first')
      console.log('   Continuing without image uploads...\n')
    } else {
      console.log('   ✅ MinIO bucket found\n')
    }
    
    // Seed database
    const users = await seedUsers()
    console.log('')
    
    await seedAddresses(users)
    console.log('')
    
    const tracks = await seedTracks(bucketExists)
    console.log('')
    
    const cars = await seedCars(bucketExists)
    console.log('')
    
    await updateTracksWithCars(tracks, cars)
    console.log('')
    
    await seedPricingConfig()
    console.log('')
    
    await seedDayMultipliers()
    console.log('')
    
    await seedFixedCosts()
    console.log('')
    
    await seedHolidayRules()
    console.log('')
    
    await seedRefundPolicies()
    console.log('')
    
    await seedReferralConfig()
    console.log('')
    
    await seedBookings(users, tracks, cars)
    console.log('')
    
    console.log('✅ Development data seeding complete!\n')
    
    console.log('📊 Summary:')
    console.log(`   Users:         ${users.length}`)
    console.log(`   Tracks:        ${tracks.length}`)
    console.log(`   Cars:          ${cars.length}`)
    console.log('')
    
    console.log('🔐 Test Credentials:')
    console.log('   Admin:')
    console.log('   - Email:    admin@example.com')
    console.log('   - Password: admin123')
    console.log('')
    console.log('   User:')
    console.log('   - Email:    john.doe@example.com')
    console.log('   - Password: password123')
    console.log('')
    
    console.log('🌐 Access your data:')
    console.log('   - Prisma Studio: npm run db:studio')
    console.log('   - MinIO Console: http://localhost:9001 (minioadmin / minioadmin)')
    console.log('   - App:          npm run dev')
    console.log('')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
