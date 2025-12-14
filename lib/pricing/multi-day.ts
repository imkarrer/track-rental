/**
 * Multi-day pricing calculation
 * Calculates pricing for bookings spanning multiple days
 */

import { calculatePricing, calculateDurationHours, PricingInput, PricingBreakdown } from "./calculate"
import { getDayOrHolidayMultiplier, getHolidayMultiplier } from "./holidays"

export interface MultiDayPricingInput {
  trackBasePrice: number
  startDate: Date
  endDate: Date
  startTime: string
  endTime: string
  setupTimeMinutes: number
  distanceFromBase: number
  selectedCars: Array<{
    carId: string
    basePricePerDay: number
    quantity: number
  }>
  taxRate?: number
}

export interface DayPricing {
  date: Date
  dayOfWeek: number
  multiplier: number
  isHoliday: boolean
  trackPrice: number
  additionalCarsPrice: number
  subtotal: number
}

export interface MultiDayPricingResult {
  days: DayPricing[]
  totalTrackPrice: number
  totalAdditionalCarsPrice: number
  distanceSurcharge: number
  setupFee: number
  subtotal: number
  tax: number
  total: number
  durationHours: number
  totalDays: number
}

/**
 * Calculate pricing for a multi-day booking
 */
export async function calculateMultiDayPricing(
  input: MultiDayPricingInput
): Promise<MultiDayPricingResult> {
  const {
    trackBasePrice,
    startDate,
    endDate,
    startTime,
    endTime,
    setupTimeMinutes,
    distanceFromBase,
    selectedCars,
    taxRate = 0.08,
  } = input

  // Generate array of dates in the range using local midnight to preserve calendar day
  const dates: Date[] = []
  const startStr = startDate.toISOString().split("T")[0]
  const endStr = endDate.toISOString().split("T")[0]

  const [sy, sm, sd] = startStr.split("-").map(Number)
  const [ey, em, ed] = endStr.split("-").map(Number)

  let current = new Date(sy, sm - 1, sd) // local midnight of start
  const endLocal = new Date(ey, em - 1, ed) // local midnight of end

  while (current <= endLocal) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  // Calculate pricing for each day
  const dayPricings: DayPricing[] = []
  let totalTrackPrice = 0
  let totalAdditionalCarsPrice = 0

  for (const date of dates) {
    // Get multiplier for this day (checks holidays first)
    const multiplier = await getDayOrHolidayMultiplier(date)
    const dayOfWeek = date.getDay()

    // Check if it's a holiday
    const holidayMultiplier = await getHolidayMultiplier(date)
    const isHoliday = holidayMultiplier !== null

    // Calculate pricing for this day
    const dayPricing = calculatePricing({
      trackBasePrice,
      eventDate: date,
      startTime,
      endTime,
      setupTimeMinutes: dates.indexOf(date) === 0 ? setupTimeMinutes : 0, // Setup fee only on first day
      distanceFromBase: dates.indexOf(date) === 0 ? distanceFromBase : 0, // Distance surcharge only on first day
      selectedCars,
      dayMultiplier: multiplier,
      taxRate: 0, // Calculate tax at the end on total
    })

    dayPricings.push({
      date,
      dayOfWeek,
      multiplier,
      isHoliday,
      trackPrice: dayPricing.trackPrice,
      additionalCarsPrice: dayPricing.additionalCarsPrice,
      subtotal: dayPricing.trackPrice + dayPricing.additionalCarsPrice,
    })

    totalTrackPrice += dayPricing.trackPrice
    totalAdditionalCarsPrice += dayPricing.additionalCarsPrice
  }

  // Distance surcharge and setup fee only apply once (on first day)
  const firstDayPricing = calculatePricing({
    trackBasePrice,
    eventDate: dates[0],
    startTime,
    endTime,
    setupTimeMinutes,
    distanceFromBase,
    selectedCars,
    dayMultiplier: dayPricings[0].multiplier,
    taxRate: 0,
  })

  const distanceSurcharge = firstDayPricing.distanceSurcharge
  const setupFee = 0

  // Calculate total duration (hours per day * number of days)
  const hoursPerDay = calculateDurationHours(startTime, endTime)
  const totalDurationHours = hoursPerDay * dates.length

  // Calculate subtotal
  const subtotal = totalTrackPrice + totalAdditionalCarsPrice + distanceSurcharge

  // Calculate tax
  const tax = subtotal * taxRate

  // Calculate total
  const total = subtotal + tax

  return {
    days: dayPricings,
    totalTrackPrice,
    totalAdditionalCarsPrice,
    distanceSurcharge,
    setupFee,
    subtotal,
    tax,
    total,
    durationHours: totalDurationHours,
    totalDays: dates.length,
  }
}


