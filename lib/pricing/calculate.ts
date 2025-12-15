import { Prisma } from "@prisma/client"
type Decimal = Prisma.Decimal

export interface PricingInput {
  trackBasePrice: number
  eventDate: Date
  startTime: string
  endTime: string
  setupTimeMinutes: number
  distanceFromBase: number
  selectedCars: Array<{
    carId: string
    basePricePerDay: number
    quantity: number
  }>
  taxRate?: number // Default 0.08 (8%)
  dayMultiplier?: number // Optional: override day multiplier (from DB)
}

export interface PricingBreakdown {
  trackBasePrice: number
  dayMultiplier: number
  durationMultiplier: number
  trackPrice: number
  freeCarsIncluded: number
  additionalCarsCount: number
  additionalCarsPrice: number
  distanceSurcharge: number
  setupFee: number
  subtotal: number
  tax: number
  total: number
  dayOfWeek: number
  durationHours: number
}

/**
 * Get day of week multiplier (synchronous version for backwards compatibility)
 * This is now a wrapper that uses defaults - use getDayMultiplier from day-multipliers.ts for DB values
 */
export function getDayMultiplier(dayOfWeek: number): number {
  const defaults: Record<number, number> = {
    0: 1.3, // Sunday
    1: 1.0, // Monday
    2: 1.0, // Tuesday
    3: 1.0, // Wednesday
    4: 1.0, // Thursday
    5: 1.2, // Friday
    6: 1.5, // Saturday
  }
  return defaults[dayOfWeek] || 1.0
}

/**
 * Get duration multiplier
 * 4 hours or less: 0.7x
 * 4-8 hours: 1.0x
 * 8+ hours: 1.3x
 */
export function getDurationMultiplier(durationHours: number): number {
  if (durationHours <= 4) {
    return 0.7
  } else if (durationHours <= 8) {
    return 1.0
  } else {
    return 1.3
  }
}

/**
 * Calculate distance surcharge
 * Within 10 miles: $0
 * 10-25 miles: $25
 * 25-50 miles: $50
 * 50+ miles: $100 + $2/mile over 50
 */
export function calculateDistanceSurcharge(distanceMiles: number): number {
  if (distanceMiles <= 10) {
    return 0
  } else if (distanceMiles <= 25) {
    return 25
  } else if (distanceMiles <= 50) {
    return 50
  } else {
    return 100 + (distanceMiles - 50) * 2
  }
}

/**
 * Calculate setup fee based on setup time
 * < 30 min: $0
 * 30-60 min: $50
 * 60+ min: $100
 */
export function calculateSetupFee(setupTimeMinutes: number): number {
  if (setupTimeMinutes < 30) {
    return 0
  } else if (setupTimeMinutes <= 60) {
    return 50
  } else {
    return 100
  }
}

/**
 * Calculate total number of cars from selected cars
 */
function getTotalCarQuantity(selectedCars: PricingInput["selectedCars"]): number {
  return selectedCars.reduce((total, car) => total + car.quantity, 0)
}

/**
 * Calculate hours between start and end time
 */
export function calculateDurationHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number)
  const [endHour, endMin] = endTime.split(":").map(Number)
  
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  // Handle case where end time is next day
  const durationMinutes = endMinutes >= startMinutes 
    ? endMinutes - startMinutes 
    : (24 * 60 - startMinutes) + endMinutes
    
  return Math.ceil(durationMinutes / 60)
}

/**
 * Main pricing calculation function
 */
export function calculatePricing(input: PricingInput): PricingBreakdown {
  const {
    trackBasePrice,
    eventDate,
    startTime,
    endTime,
    setupTimeMinutes,
    distanceFromBase,
    selectedCars,
    taxRate = 0.08,
  } = input

  // Calculate day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = eventDate.getDay()
  // Use provided multiplier or fall back to default
  const dayMultiplier = input.dayMultiplier ?? getDayMultiplier(dayOfWeek)

  // Calculate duration
  const durationHours = calculateDurationHours(startTime, endTime)
  const durationMultiplier = getDurationMultiplier(durationHours)

  // Calculate track price
  const trackPrice = trackBasePrice * dayMultiplier * durationMultiplier

  // Calculate car pricing (first 2 cars are free)
  const totalCarQuantity = getTotalCarQuantity(selectedCars)
  const freeCarsIncluded = 2
  const additionalCarsCount = Math.max(0, totalCarQuantity - freeCarsIncluded)

  // Calculate additional cars price
  // First, determine total quantity and which cars are free
  let remainingFree = freeCarsIncluded
  let additionalCarsPrice = 0
  
  if (additionalCarsCount > 0) {
    // Calculate price for each additional car
    // We need to allocate free cars across all selected cars
    for (const car of selectedCars) {
      const carPricePerUnit = car.basePricePerDay * dayMultiplier * durationMultiplier
      
      // Determine how many of this car type are free vs paid
      let paidQuantity = 0
      
      for (let i = 0; i < car.quantity; i++) {
        if (remainingFree > 0) {
          remainingFree--
        } else {
          paidQuantity++
        }
      }
      
      additionalCarsPrice += carPricePerUnit * paidQuantity
    }
  }

  // Calculate fees (setupFee no longer charged to customer; kept for backward-compatibility as 0)
  const distanceSurcharge = calculateDistanceSurcharge(distanceFromBase)
  const setupFee = 0

  // Calculate subtotal
  const subtotal = trackPrice + additionalCarsPrice + distanceSurcharge

  // Calculate tax
  const tax = subtotal * taxRate

  // Calculate total
  const total = subtotal + tax

  return {
    trackBasePrice,
    dayMultiplier,
    durationMultiplier,
    trackPrice: Math.round(trackPrice * 100) / 100,
    freeCarsIncluded,
    additionalCarsCount,
    additionalCarsPrice: Math.round(additionalCarsPrice * 100) / 100,
    distanceSurcharge,
    setupFee,
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
    dayOfWeek,
    durationHours,
  }
}

