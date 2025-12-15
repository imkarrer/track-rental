// Catchy referral code name generator
export function generateCatchyCodeName(): string {
  const adjectives = [
    "Super", "Mega", "Ultra", "Epic", "Prime", "Elite", "Pro", "Max", "Plus", "Turbo",
    "Rocket", "Lightning", "Thunder", "Blazing", "Golden", "Silver", "Diamond", "Platinum",
    "Supreme", "Ultimate", "Legendary", "Radical", "Awesome", "Amazing", "Fantastic"
  ]
  
  const nouns = [
    "Speed", "Racing", "Track", "Victory", "Champion", "Winner", "Racer", "Driver", "Throttle",
    "Drift", "Circuit", "Sprint", "Dash", "Rush", "Blitz", "Boost", "Launch", "Nitro",
    "Turbo", "Engine", "Power", "Force", "Energy", "Fuel", "Gear"
  ]
  
  const events = [
    "Summer", "Spring", "Winter", "Fall", "Holiday", "Weekend", "Launch", "Grand",
    "Opening", "Special", "Flash", "Limited", "VIP", "Exclusive", "Premium", "Early"
  ]
  
  const types = [
    "Sale", "Deal", "Offer", "Discount", "Promo", "Event", "Special", "Bonus",
    "Reward", "Gift", "Treat", "Savings", "Value", "Bundle", "Package"
  ]
  
  // Random combination patterns
  const patterns = [
    () => `${randomFrom(events)}${randomFrom(types)}`,
    () => `${randomFrom(adjectives)}${randomFrom(nouns)}`,
    () => `${randomFrom(events)}${randomFrom(nouns)}`,
    () => `${randomFrom(adjectives)}${randomFrom(types)}`,
    () => `${randomFrom(adjectives)}${randomFrom(nouns)}${randomFrom(types)}`
  ]
  
  const pattern = randomFrom(patterns)
  return pattern()
}

export function generatePromoCode(name?: string): string {
  // If a name is provided, create code from it
  if (name) {
    // Remove special characters and spaces, uppercase
    const cleaned = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    if (cleaned.length >= 4) {
      return cleaned.substring(0, 15) // Max 15 chars
    }
  }
  
  // Generate random code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function randomFrom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

// Generate user referral code (simpler, shorter)
export function generateUserReferralCode(userId: string): string {
  // Use first 8 chars of UUID + random suffix
  const prefix = userId.replace(/-/g, '').substring(0, 6).toUpperCase()
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}${suffix}`
}

