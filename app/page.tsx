import Link from "next/link"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/db/prisma"

// Mark as dynamic to prevent prerendering (uses database)
export const dynamic = 'force-dynamic'

const DEFAULT_DAY_MULTIPLIERS: Record<number, number> = {
  0: 1.3,
  1: 1.0,
  2: 1.0,
  3: 1.0,
  4: 1.0,
  5: 1.2,
  6: 1.5,
}

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
}

export default async function Home() {
  const [dayMultipliersRaw, fixedConfig] = await Promise.all([
    prisma.dayMultiplier.findMany({ orderBy: { dayOfWeek: "asc" } }).catch(() => []),
    prisma.fixedCostsConfig.findFirst().catch(() => null),
  ])

  const dayMultipliers: Record<number, number> =
    dayMultipliersRaw.length > 0
      ? dayMultipliersRaw.reduce<Record<number, number>>((acc, cur) => {
          acc[cur.dayOfWeek] = Number(cur.multiplier)
          return acc
        }, {})
      : DEFAULT_DAY_MULTIPLIERS

  const dayEntries = Array.from({ length: 7 }, (_, i) => ({
    label: DAY_LABELS[i],
    multiplier: dayMultipliers[i] ?? DEFAULT_DAY_MULTIPLIERS[i],
  }))

  const holidayMultiplier = fixedConfig?.holidayMultiplier
    ? Number(fixedConfig.holidayMultiplier)
    : 1.5

  return (
    <main>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
              🏁 Road Racing & Rock Crawling Tracks for Rent
            </h1>
            <p className="text-lg mb-6 text-blue-100">
              Bring pro-grade RC action to your event—blistering road courses or rock crawling adventure, built to thrill.
            </p>
            <Link href="/tracks">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                🛒 Browse Tracks
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Policies & Pricing */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🚗</span>
                <h3 className="text-lg font-semibold">Two-Car Policy</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">
                First two cars ride free with every track rental. Extra cars are optional add-ons if you need more rides.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📅</span>
                <h3 className="text-lg font-semibold">Daily Pricing</h3>
              </div>
              <div className="text-gray-700 text-sm leading-relaxed">
                <p className="text-sm mb-2">
                  Straightforward day rates—no separate setup fee.
                </p>
                <div className="grid grid-cols-2 gap-x-3 text-xs">
                  {dayEntries.map((d) => (
                    <div key={d.label} className="flex justify-between">
                      <span>{d.label}:</span>
                      <span className="font-medium">{d.multiplier}x</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎉</span>
                <h3 className="text-lg font-semibold">Holiday Pricing</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">
                Simple holiday multiplier on federal holidays—clear and predictable. Current: {holidayMultiplier}x.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bar */}
      <section className="py-8 bg-blue-600 text-white">
        <div className="container mx-auto px-4">
          <Link href="/tracks" className="block">
            <Button
              className="w-full h-20 text-xl bg-white text-blue-700 hover:bg-blue-50 flex items-center justify-center gap-3"
              size="lg"
            >
              🚀 Reserve Your Track Today
            </Button>
          </Link>
          <p className="text-blue-100 text-sm mt-3 text-center">
            First two cars included. Holds are timed to keep dates open for everyone.
          </p>
        </div>
      </section>
    </main>
  )
}

