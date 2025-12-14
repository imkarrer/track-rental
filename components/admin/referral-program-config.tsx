"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ProgramConfig = {
  id: "user" | "admin"
  enabled: boolean
  referrerType: "PERCENT" | "FLAT"
  referrerPercentOff?: number
  referrerAmountOff?: number
  referrerApplyOnce: boolean
  refereeType: "PERCENT" | "FLAT"
  refereePercentOff?: number
  refereeAmountOff?: number
  refereeApplyOnce: boolean
}

const DEFAULTS: Record<ProgramConfig["id"], ProgramConfig> = {
  user: {
    id: "user",
    enabled: true,
    referrerType: "PERCENT",
    referrerPercentOff: 5,
    referrerAmountOff: 0,
    referrerApplyOnce: true,
    refereeType: "PERCENT",
    refereePercentOff: 10,
    refereeAmountOff: 0,
    refereeApplyOnce: true,
  },
  admin: {
    id: "admin",
    enabled: true,
    referrerType: "PERCENT",
    referrerPercentOff: 0,
    referrerAmountOff: 25,
    referrerApplyOnce: true,
    refereeType: "PERCENT",
    refereePercentOff: 15,
    refereeAmountOff: 0,
    refereeApplyOnce: true,
  },
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max,
}: {
  value?: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <Input
      className="w-24"
      type="number"
      value={value ?? 0}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function ReferralProgramConfigCard() {
  const [programs, setPrograms] = useState<Record<ProgramConfig["id"], ProgramConfig>>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const safeJson = async (res: Response) => {
    const text = await res.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async () => {
    setError(null)
    try {
      const res = await fetch("/api/admin/referrals/incentive")
      const json = await safeJson(res)
      if (res.ok && json.programs) {
        setPrograms(json.programs)
      } else {
        throw new Error(json.error || "Failed to load program config")
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load program config")
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/referrals/incentive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programs: Object.values(programs) }),
      })
      const json = await safeJson(res)
      if (!res.ok) {
        throw new Error(json.error || "Failed to save")
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const update = (id: ProgramConfig["id"], patch: Partial<ProgramConfig>) => {
    setPrograms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral Programs</CardTitle>
        <CardDescription>
          Configure user and admin referral programs separately for referrer and referee bonuses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {["user", "admin"].map((id) => {
            const p = programs[id as ProgramConfig["id"]]
            return (
              <div key={id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="font-semibold capitalize">{id} program</label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => update(id as any, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                {id === "admin" ? (
                  <div className="space-y-2 border rounded p-2">
                    <p className="text-sm font-semibold">Referee bonus</p>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={p.refereeType}
                      onChange={(e) => update(id as any, { refereeType: e.target.value as any })}
                    >
                      <option value="PERCENT">Percent off</option>
                      <option value="FLAT">Flat $</option>
                    </select>
                    {p.refereeType === "PERCENT" ? (
                      <NumberInput
                        value={p.refereePercentOff}
                        min={0}
                        max={100}
                        onChange={(n) => update(id as any, { refereePercentOff: n })}
                      />
                    ) : (
                      <NumberInput
                        value={p.refereeAmountOff}
                        min={0}
                        onChange={(n) => update(id as any, { refereeAmountOff: n })}
                      />
                    )}
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={p.refereeApplyOnce}
                        onChange={(e) => update(id as any, { refereeApplyOnce: e.target.checked })}
                      />
                      Apply once
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2 border rounded p-2">
                      <p className="text-sm font-semibold">Referrer bonus</p>
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={p.referrerType}
                        onChange={(e) => update(id as any, { referrerType: e.target.value as any })}
                        disabled
                      >
                        <option value="PERCENT">Percent off</option>
                        <option value="FLAT">Flat $</option>
                      </select>
                      {p.referrerType === "PERCENT" ? (
                        <NumberInput
                          value={p.referrerPercentOff}
                          min={0}
                          max={100}
                          onChange={(n) => update(id as any, { referrerPercentOff: n })}
                          disabled
                        />
                      ) : (
                        <NumberInput
                          value={p.referrerAmountOff}
                          min={0}
                          onChange={(n) => update(id as any, { referrerAmountOff: n })}
                          disabled
                        />
                      )}
                      <p className="text-xs text-gray-600">Applies every time for referrers.</p>
                    </div>

                    <div className="space-y-2 border rounded p-2">
                      <p className="text-sm font-semibold">Referee bonus</p>
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={p.refereeType}
                        onChange={(e) => update(id as any, { refereeType: e.target.value as any })}
                      >
                        <option value="PERCENT">Percent off</option>
                        <option value="FLAT">Flat $</option>
                      </select>
                      {p.refereeType === "PERCENT" ? (
                        <NumberInput
                          value={p.refereePercentOff}
                          min={0}
                          max={100}
                          onChange={(n) => update(id as any, { refereePercentOff: n })}
                        />
                      ) : (
                        <NumberInput
                          value={p.refereeAmountOff}
                          min={0}
                          onChange={(n) => update(id as any, { refereeAmountOff: n })}
                        />
                      )}
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={p.refereeApplyOnce}
                          onChange={(e) => update(id as any, { refereeApplyOnce: e.target.checked })}
                        />
                        Apply once
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 items-center">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Programs"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </CardContent>
    </Card>
  )
}


