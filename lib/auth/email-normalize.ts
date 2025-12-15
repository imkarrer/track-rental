const GMAIL_DOMAINS = ["gmail.com", "googlemail.com"]

export function normalizeEmail(email: string): { canonical: string; original: string } {
  const lower = email.trim().toLowerCase()
  const [local, domain] = lower.split("@")
  if (!domain) return { canonical: lower, original: email }

  if (GMAIL_DOMAINS.includes(domain)) {
    const plusIdx = local.indexOf("+")
    const localNoPlus = plusIdx >= 0 ? local.slice(0, plusIdx) : local
    const localNoDots = localNoPlus.replace(/\./g, "")
    return { canonical: `${localNoDots}@${domain}`, original: email }
  }

  return { canonical: lower, original: email }
}


