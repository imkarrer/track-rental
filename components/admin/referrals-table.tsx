"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type Redemption = {
  id: string
  referredUserId: string
  user?: {
    email: string | null
    firstName: string | null
    lastName: string | null
    createdAt: string
  } | null
  createdAt: string
}

type ReferralCode = {
  id: string
  code: string
  maxUses: number
  uses: number
  createdAt: string
  redemptions: Redemption[]
}

type ReferralCodeWithOwner = ReferralCode & {
  owner?: {
    email: string | null
    firstName: string | null
    lastName: string | null
  } | null
}

export function ReferralsTable({ initialCodes }: { initialCodes: ReferralCodeWithOwner[] }) {
  const [codes, setCodes] = useState<ReferralCodeWithOwner[]>(initialCodes)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setError(null)
    try {
      const res = await fetch("/api/referrals/me")
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to load referrals")
      }
      setCodes(json.codes || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load referrals")
    }
  }

  useEffect(() => {
    // Keep in sync if other admin actions occur
    refresh()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Button variant="outline" onClick={refresh}>
          🔄 Refresh
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {codes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-semibold mb-2">No user referral codes yet</p>
          <p className="text-sm">
            User referral codes are automatically created when users sign up or when they first 
            access their referral dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((code) => (
            <div key={code.id} className="border rounded-lg p-4 space-y-2 hover:border-gray-300 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-mono font-bold tracking-wide text-green-700">
                      {code.code}
                    </p>
                    <Badge variant="outline">
                      {code.uses}/{code.maxUses} used
                    </Badge>
                  </div>
                  {code.owner && (
                    <div className="text-sm text-gray-600 mt-1">
                      Owned by: <span className="font-semibold">{code.owner.email}</span>
                      {(code.owner.firstName || code.owner.lastName) && (
                        <span className="text-gray-500 ml-2">
                          ({code.owner.firstName} {code.owner.lastName})
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Created {new Date(code.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {code.redemptions.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-semibold mb-2">
                    Redemptions ({code.redemptions.length})
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {code.redemptions.map((r) => (
                      <div key={r.id} className="text-xs text-gray-700 flex justify-between bg-gray-50 p-2 rounded">
                        <div>
                          <span className="font-semibold">
                            {r.user?.email || r.referredUserId}
                          </span>
                          {r.user && (
                            <span className="text-gray-500 ml-2">
                              {(r.user.firstName || "") + " " + (r.user.lastName || "")}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-500">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


