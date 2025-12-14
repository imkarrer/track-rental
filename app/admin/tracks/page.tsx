import Link from "next/link"
import { prisma } from "@/lib/db/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrackDetailsCard } from "@/components/admin/track-details-card"
import { calculateBreakEven } from "@/lib/pricing/break-even"
import { getFixedCostsConfig } from "@/lib/pricing/fixed-costs"
import { calculateBatteryCosts } from "@/lib/pricing/battery-costs"
import { calculateChargerCosts } from "@/lib/pricing/charger-costs"

export default async function AdminTracksPage() {
  const tracks = await prisma.track.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      // We'll fetch included cars separately since Prisma doesn't support array includes directly
    },
  })

  // Fetch all cars to match with includedCarIds
  const allCars = await prisma.car.findMany()

  // Get fixed costs config for break-even calculations
  const fixedCostsConfig = await getFixedCostsConfig()

  // Calculate battery and charger costs
  let batteryCosts = 0
  let chargerCosts = 0
  try {
    const batteryCostResult = await calculateBatteryCosts(8, "ROAD", fixedCostsConfig.laborRatePerHour)
    batteryCosts = batteryCostResult.totalCost
    const chargerCostResult = await calculateChargerCosts(fixedCostsConfig.monthlyRentalsTarget)
    chargerCosts = chargerCostResult.totalChargerCost
  } catch (error) {
    console.error("Error calculating battery/charger costs:", error)
  }

  // Enrich tracks with included cars and break-even analysis
  const tracksWithDetails = await Promise.all(
    tracks.map(async (track) => {
      // Find included cars
      const includedCarsRaw = track.includedCarIds
        ? allCars.filter((car) => track.includedCarIds.includes(car.id))
        : []
      const includedCars = includedCarsRaw.map((car) => ({
        ...car,
        basePricePerDay: Number(car.basePricePerDay),
        unitCost: car.unitCost ? Number(car.unitCost) : null,
        createdAt: car.createdAt ? car.createdAt.toISOString() : new Date().toISOString(),
      }))

      // Calculate total car costs
      const carCosts = includedCars.reduce((sum, car) => {
        return sum + (car.unitCost ? Number(car.unitCost) : 0)
      }, 0)

      // Calculate break-even analysis if unitCost is available
      let breakEvenAnalysis = null
      if (track.unitCost && Number(track.unitCost) > 0) {
        breakEvenAnalysis = calculateBreakEven(
          Number(track.basePrice),
          Number(track.unitCost),
          track.setupTimeMinutes || 0,
          carCosts,
          {
            ...fixedCostsConfig,
            batteryCosts: batteryCosts + chargerCosts,
            setupTimeHours: (track.setupTimeMinutes || 0) / 60,
          }
        )
      }

      return {
        ...track,
        basePrice: Number(track.basePrice),
        length: Number(track.length),
        width: Number(track.width),
        minSpaceLength: Number(track.minSpaceLength),
        minSpaceWidth: Number(track.minSpaceWidth),
        unitCost: track.unitCost ? Number(track.unitCost) : null,
        includedCars,
        carCosts,
        breakEvenAnalysis,
      }
    })
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Manage Tracks</h2>
        <Link href="/admin/tracks/new">
          <Button>Add New Track</Button>
        </Link>
      </div>

      {tracksWithDetails.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 mb-4">No tracks found</p>
            <Link href="/admin/tracks/new">
              <Button>Create Your First Track</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tracksWithDetails.map((track) => (
            <TrackDetailsCard key={track.id} track={track} />
          ))}
        </div>
      )}
    </div>
  )
}
