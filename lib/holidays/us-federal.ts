/**
 * US Federal Bank Holidays Calculator
 * 
 * Automatically calculates the date of US federal holidays for any year.
 * Supports all 10 federal bank holidays with proper observance rules.
 */

export type HolidayRule = {
  id: string
  name: string
  description: string
  type: 'fixed' | 'nth-weekday' | 'relative'
  // For fixed dates
  month?: number // 1-12
  day?: number // 1-31
  // For nth-weekday
  weekday?: number // 0=Sunday, 1=Monday, etc.
  week?: number // 1-5, or -1 for last
  // Observance rules
  observedOnMonday?: boolean // If falls on Sunday, observed on Monday
  observedOnFriday?: boolean // If falls on Saturday, observed on Friday
  priceMultiplier: number // Default multiplier for this holiday
  isActive: boolean
}

/**
 * Get the nth occurrence of a weekday in a month
 * @param year The year
 * @param month The month (1-12)
 * @param weekday The day of week (0=Sunday, 6=Saturday)
 * @param n Which occurrence (1-5, or -1 for last)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  if (n === -1) {
    // Last occurrence
    // Start from the last day of the month and work backwards
    const lastDay = new Date(year, month, 0)
    const lastDayOfWeek = lastDay.getDay()
    const diff = (lastDayOfWeek - weekday + 7) % 7
    return new Date(year, month - 1, lastDay.getDate() - diff)
  } else {
    // Nth occurrence from start
    const firstDay = new Date(year, month - 1, 1)
    const firstDayOfWeek = firstDay.getDay()
    const diff = (weekday - firstDayOfWeek + 7) % 7
    const date = 1 + diff + (n - 1) * 7
    return new Date(year, month - 1, date)
  }
}

/**
 * Apply observance rules (weekend adjustments)
 */
function applyObservanceRules(date: Date, rule: HolidayRule): Date {
  const dayOfWeek = date.getDay()
  
  // If holiday falls on Sunday and observed on Monday
  if (dayOfWeek === 0 && rule.observedOnMonday) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  }
  
  // If holiday falls on Saturday and observed on Friday
  if (dayOfWeek === 6 && rule.observedOnFriday) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
  }
  
  return date
}

/**
 * Calculate the actual date of a holiday for a given year
 */
export function calculateHolidayDate(rule: HolidayRule, year: number): Date {
  let date: Date
  
  switch (rule.type) {
    case 'fixed':
      // Fixed date (e.g., Christmas on December 25)
      if (!rule.month || !rule.day) {
        throw new Error(`Fixed holiday ${rule.name} missing month or day`)
      }
      date = new Date(year, rule.month - 1, rule.day)
      break
      
    case 'nth-weekday':
      // Nth weekday of month (e.g., Labor Day - 1st Monday of September)
      if (!rule.month || rule.weekday === undefined || !rule.week) {
        throw new Error(`Nth-weekday holiday ${rule.name} missing required fields`)
      }
      date = getNthWeekdayOfMonth(year, rule.month, rule.weekday, rule.week)
      break
      
    case 'relative':
      // For future expansion (e.g., Easter-based holidays)
      throw new Error(`Relative holidays not yet implemented`)
      
    default:
      throw new Error(`Unknown holiday type: ${rule.type}`)
  }
  
  // Apply observance rules for weekend adjustments
  return applyObservanceRules(date, rule)
}

/**
 * 10 US Federal Bank Holidays
 */
export const US_FEDERAL_HOLIDAYS: HolidayRule[] = [
  {
    id: 'new-years-day',
    name: "New Year's Day",
    description: "January 1st",
    type: 'fixed',
    month: 1,
    day: 1,
    observedOnMonday: true,
    observedOnFriday: true,
    priceMultiplier: 1.5,
    isActive: true,
  },
  {
    id: 'mlk-day',
    name: "Martin Luther King Jr. Day",
    description: "Third Monday in January",
    type: 'nth-weekday',
    month: 1,
    weekday: 1, // Monday
    week: 3,
    priceMultiplier: 1.3,
    isActive: true,
  },
  {
    id: 'presidents-day',
    name: "Presidents' Day",
    description: "Third Monday in February",
    type: 'nth-weekday',
    month: 2,
    weekday: 1, // Monday
    week: 3,
    priceMultiplier: 1.3,
    isActive: true,
  },
  {
    id: 'memorial-day',
    name: "Memorial Day",
    description: "Last Monday in May",
    type: 'nth-weekday',
    month: 5,
    weekday: 1, // Monday
    week: -1, // Last
    priceMultiplier: 1.5,
    isActive: true,
  },
  {
    id: 'juneteenth',
    name: "Juneteenth National Independence Day",
    description: "June 19th",
    type: 'fixed',
    month: 6,
    day: 19,
    observedOnMonday: true,
    observedOnFriday: true,
    priceMultiplier: 1.3,
    isActive: true,
  },
  {
    id: 'independence-day',
    name: "Independence Day",
    description: "July 4th",
    type: 'fixed',
    month: 7,
    day: 4,
    observedOnMonday: true,
    observedOnFriday: true,
    priceMultiplier: 1.5,
    isActive: true,
  },
  {
    id: 'labor-day',
    name: "Labor Day",
    description: "First Monday in September",
    type: 'nth-weekday',
    month: 9,
    weekday: 1, // Monday
    week: 1,
    priceMultiplier: 1.5,
    isActive: true,
  },
  {
    id: 'columbus-day',
    name: "Columbus Day",
    description: "Second Monday in October",
    type: 'nth-weekday',
    month: 10,
    weekday: 1, // Monday
    week: 2,
    priceMultiplier: 1.2,
    isActive: true,
  },
  {
    id: 'veterans-day',
    name: "Veterans Day",
    description: "November 11th",
    type: 'fixed',
    month: 11,
    day: 11,
    observedOnMonday: true,
    observedOnFriday: true,
    priceMultiplier: 1.3,
    isActive: true,
  },
  {
    id: 'thanksgiving',
    name: "Thanksgiving Day",
    description: "Fourth Thursday in November",
    type: 'nth-weekday',
    month: 11,
    weekday: 4, // Thursday
    week: 4,
    priceMultiplier: 1.5,
    isActive: true,
  },
  {
    id: 'christmas',
    name: "Christmas Day",
    description: "December 25th",
    type: 'fixed',
    month: 12,
    day: 25,
    observedOnMonday: true,
    observedOnFriday: true,
    priceMultiplier: 1.5,
    isActive: true,
  },
]

/**
 * Get all federal holidays for a specific year
 */
export function getFederalHolidaysForYear(year: number): Array<{
  rule: HolidayRule
  date: Date
  dateString: string
}> {
  return US_FEDERAL_HOLIDAYS
    .filter(rule => rule.isActive)
    .map(rule => {
      const date = calculateHolidayDate(rule, year)
      return {
        rule,
        date,
        dateString: date.toISOString().split('T')[0], // YYYY-MM-DD
      }
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Check if a specific date is a federal holiday
 */
export function isHoliday(dateString: string): {
  isHoliday: boolean
  holiday?: HolidayRule
  observedDate?: string
} {
  const date = new Date(dateString + 'T00:00:00')
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return { isHoliday: false }
  }
  
  const year = date.getFullYear()
  const holidays = getFederalHolidaysForYear(year)
  
  const match = holidays.find(h => h.dateString === dateString)
  
  if (match) {
    return {
      isHoliday: true,
      holiday: match.rule,
      observedDate: match.dateString,
    }
  }
  
  return { isHoliday: false }
}

/**
 * Get the price multiplier for a specific date
 */
export function getHolidayMultiplier(dateString: string): number {
  const result = isHoliday(dateString)
  return result.isHoliday && result.holiday ? result.holiday.priceMultiplier : 1.0
}

/**
 * Get holidays within a date range
 */
export function getHolidaysInRange(startDate: string, endDate: string): Array<{
  rule: HolidayRule
  date: Date
  dateString: string
}> {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()
  
  const allHolidays: Array<{
    rule: HolidayRule
    date: Date
    dateString: string
  }> = []
  
  // Get holidays for all years in the range
  for (let year = startYear; year <= endYear; year++) {
    allHolidays.push(...getFederalHolidaysForYear(year))
  }
  
  // Filter to only holidays within the date range
  return allHolidays.filter(h => {
    return h.date >= start && h.date <= end
  })
}

