"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type ProgramConfig = {
  user: {
    enabled: boolean
    referrerType: "PERCENT" | "FLAT"
    referrerPercentOff?: number
    referrerAmountOff?: number
    refereeType: "PERCENT" | "FLAT"
    refereePercentOff?: number
    refereeAmountOff?: number
    refereeApplyOnce: boolean
  }
}

type ReferralCode = {
  code: string
  uses: number
  maxUses: number
  createdAt: string
}

export function MyReferral() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<ReferralCode[]>([])
  const [program, setProgram] = useState<ProgramConfig["user"] | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfgRes, codesRes] = await Promise.all([
        fetch("/api/admin/referrals/incentive", { cache: "no-store" }),
        fetch("/api/referrals/me", { cache: "no-store" }),
      ])
      const cfgJson = await safeJson(cfgRes)
      const codesJson = await safeJson(codesRes)
      if (cfgJson?.programs?.user) {
        setProgram(cfgJson.programs.user)
      }
      setCodes(codesJson.codes || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load referrals")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createCode = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/referrals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || "Failed to create code")
      await load()
    } catch (err: any) {
      setError(err?.message || "Failed to create code")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Referral Code</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    )
  }

  if (!program?.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Referral Code</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          The referral program is currently disabled.
        </CardContent>
      </Card>
    )
  }

  const currentCode = codes[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Referral Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {currentCode ? (
          <>
            <div className="flex items-center gap-3">
              <code className="px-2 py-1 bg-gray-100 rounded text-sm font-semibold">
                {currentCode.code}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(currentCode.code)}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-600">
              Uses: {currentCode.uses}/{currentCode.maxUses}
            </p>
            <p className="text-xs text-gray-500">
              Share this code with friends. They redeem it from their account, and you both get the
              configured incentive. Self-referrals are blocked.
            </p>
          </>
        ) : (
          <Button onClick={createCode} disabled={saving}>
            {saving ? "Creating..." : "Generate my code"}
          </Button>
        )}
        {program && (
          <div className="text-xs text-gray-700 space-y-1 bg-gray-50 rounded p-2">
            <p className="font-semibold">Referral benefits</p>
            <p>
              Referrer: {formatBenefit(program.referrerType, program.referrerPercentOff, program.referrerAmountOff)} (every time)
            </p>
            <p>
              Referee: {formatBenefit(program.refereeType, program.refereePercentOff, program.refereeAmountOff)}{" "}
              {program.refereeApplyOnce ? "(first time)" : "(every time)"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function safeJson(res: Response) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function formatBenefit(
  type: "PERCENT" | "FLAT",
  pct?: number,
  amt?: number
): string {
  if (type === "PERCENT") {
    return `${pct ?? 0}% off`
  }
  return `$${(amt ?? 0).toFixed(2)} off`
}



