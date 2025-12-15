const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateReferralCode(length = 8): string {
  let out = ""
  for (let i = 0; i < length; i++) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  }
  return out
}


