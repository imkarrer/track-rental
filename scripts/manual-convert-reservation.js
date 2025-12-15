// Simple script to manually convert a reservation to a booking
// Run with: node scripts/manual-convert-reservation.js <reservationId>

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const reservationId = process.argv[2] || '5a23c426-c103-44b2-b0bf-6fc95044b33e'

async function main() {
  console.log(`Looking for reservation: ${reservationId}`)
  
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { user: true, track: true }
  })
  
  if (!reservation) {
    console.log('❌ Reservation not found')
    return
  }
  
  console.log('\nReservation found:')
  console.log(`  User: ${reservation.user.email}`)
  console.log(`  Track: ${reservation.track.name}`)
  console.log(`  Event Date: ${reservation.eventDate.toISOString().split('T')[0]}`)
  console.log(`  Expires: ${reservation.expiresAt.toISOString()}`)
  console.log(`  Is Expired: ${reservation.expiresAt < new Date() ? 'Yes' : 'No'}`)
  
  // Check if a booking already exists for this reservation
  const existingBooking = await prisma.booking.findFirst({
    where: { reservationId: reservationId }
  })
  
  if (existingBooking) {
    console.log(`\n✅ Booking already exists: ${existingBooking.id}`)
    console.log(`   Status: ${existingBooking.status}`)
    return
  }
  
  console.log('\nCreating booking...')
  
  // Create booking directly
  const booking = await prisma.booking.create({
    data: {
      userId: reservation.userId,
      trackId: reservation.trackId,
      eventDate: reservation.eventDate,
      endDate: reservation.endDate,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      durationHours: reservation.durationHours,
      eventAddress: reservation.eventAddress,
      eventCity: reservation.eventCity,
      eventState: reservation.eventState,
      eventZip: reservation.eventZip,
      availableSpaceLength: reservation.availableSpaceLength,
      availableSpaceWidth: reservation.availableSpaceWidth,
      distanceFromBase: reservation.distanceFromBase,
      dayOfWeek: reservation.dayOfWeek,
      basePrice: reservation.basePrice,
      dayMultiplier: reservation.dayMultiplier,
      durationMultiplier: reservation.durationMultiplier,
      distanceSurcharge: reservation.distanceSurcharge,
      setupFee: 0,
      freeCarsIncluded: reservation.freeCarsIncluded,
      additionalCarsCount: reservation.additionalCarsCount,
      additionalCarsPrice: reservation.additionalCarsPrice,
      referralCode: reservation.referralCode,
      referralDiscount: reservation.referralDiscount,
      rewardId: reservation.rewardId,
      rewardDiscount: reservation.rewardDiscount,
      subtotal: reservation.subtotal,
      tax: reservation.tax,
      total: reservation.total,
      status: 'CONFIRMED',
      reservationId: reservation.id,
      paymentIntentId: `manual_${Date.now()}`,
      phone: reservation.user.phone || '',
    },
  })
  
  console.log(`✅ Created booking: ${booking.id}`)
  
  // Create booking cars
  const selectedCars = reservation.selectedCars
  if (selectedCars && Array.isArray(selectedCars) && selectedCars.length > 0) {
    console.log('\nCreating booking cars...')
    
    let freeCarsRemaining = reservation.freeCarsIncluded
    
    for (const selectedCar of selectedCars) {
      const car = await prisma.car.findUnique({ where: { id: selectedCar.carId } })
      if (!car) continue
      
      const isFree = freeCarsRemaining > 0
      const quantity = Math.min(selectedCar.quantity, isFree ? freeCarsRemaining : selectedCar.quantity)
      
      if (isFree) {
        freeCarsRemaining -= quantity
      }
      
      const unitPrice = isFree ? 0 : Number(car.basePricePerDay)
      const totalPrice = unitPrice * quantity
      
      await prisma.bookingCar.create({
        data: {
          bookingId: booking.id,
          carId: selectedCar.carId,
          quantity,
          isFree,
          unitPrice,
          totalPrice,
        },
      })
      
      console.log(`  ✅ Added ${quantity}x ${car.name} (${isFree ? 'FREE' : `$${unitPrice}`})`)
    }
  }
  
  // Delete the reservation
  console.log('\nDeleting reservation...')
  await prisma.reservation.delete({ where: { id: reservationId } })
  console.log('✅ Reservation deleted')
  
  console.log('\n✅ Done! Booking created successfully')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
