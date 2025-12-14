import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { calculateBatteryCosts } from "@/lib/pricing/battery-costs"
import { calculateChargerCosts } from "@/lib/pricing/charger-costs"

const fixedCostsSchema = z.object({
  expectedRentals: z.number().int().positive().optional(),
  monthlyRentalsTarget: z.number().int().positive().optional(),
  laborRatePerHour: z.number().positive().optional(),
  breakdownTimeHours: z.number().positive().optional(),
  averageDistanceMiles: z.number().positive().optional(),
  fuelCostPerMile: z.number().positive().optional(),
  apiEmailCosts: z.number().positive().optional(),
  smsCostPerMessage: z.number().positive().optional(),
  stripeFeeRate: z.number().min(0).max(1).optional(),
  stripeFixedFee: z.number().positive().optional(),
  serverHostingMonthly: z.number().positive().optional(),
  databaseMonthly: z.number().positive().optional(),
  emailServiceMonthly: z.number().positive().optional(),
  domainMonthly: z.number().positive().optional(),
  insuranceMonthly: z.number().positive().optional(),
  holidayMultiplier: z.number().positive().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Use loose client to avoid type issues if migration not generated
    const client = prisma as any

    // Get the first (and should be only) config record
    let config = await client.fixedCostsConfig.findFirst()

    // If no config exists, create one with defaults
    if (!config) {
      config = await client.fixedCostsConfig.create({
        data: {},
      })
    }

    // Calculate total monthly recurring costs
    const totalMonthlyRecurring = Number(config.serverHostingMonthly) +
      Number(config.databaseMonthly) +
      Number(config.emailServiceMonthly) +
      Number(config.domainMonthly) +
      Number(config.insuranceMonthly)

    // Calculate battery and charger costs (using average 8-hour rental for fixed costs)
    let batteryCosts = 0
    let chargerCosts = 0
    
    try {
      // Calculate battery costs for an average 8-hour rental (ROAD category as default)
      const batteryCostResult = await calculateBatteryCosts(8, "ROAD", Number(config.laborRatePerHour || 20))
      batteryCosts = batteryCostResult.totalCost
      
      // Calculate charger costs
      const chargerCostResult = await calculateChargerCosts(Number(config.monthlyRentalsTarget || 4))
      chargerCosts = chargerCostResult.totalChargerCost
    } catch (error) {
      console.error("Error calculating battery/charger costs:", error)
      // Continue with 0 if calculation fails
    }

    return NextResponse.json({
      config: {
        ...config,
        holidayMultiplier: config.holidayMultiplier,
        smsCostPerMessage: config.smsCostPerMessage,
        totalMonthlyRecurring,
        batteryCostsPerRental: batteryCosts,
        chargerCostsPerRental: chargerCosts,
        totalBatteryChargerCostsPerRental: batteryCosts + chargerCosts,
      },
    })
  } catch (error) {
    // Check for Prisma model not found error
    if (error instanceof Error && error.message.includes("fixedCostsConfig")) {
      return NextResponse.json(
        {
          error: "Database table not found. Please run: npm run db:push",
          hint: "The FixedCostsConfig table needs to be created in the database",
        },
        { status: 503 }
      )
    }
    
    console.error("Error fetching fixed costs config:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch fixed costs configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validatedData = fixedCostsSchema.parse(body)

    const client = prisma as any

    // Get existing config or create one
    let config = await client.fixedCostsConfig.findFirst()

    if (!config) {
      config = await client.fixedCostsConfig.create({
        data: validatedData,
      })
    } else {
      config = await client.fixedCostsConfig.update({
        where: { id: config.id },
        data: validatedData,
      })
    }

    // Calculate total monthly recurring costs
    const totalMonthlyRecurring = Number(config.serverHostingMonthly) +
      Number(config.databaseMonthly) +
      Number(config.emailServiceMonthly) +
      Number(config.domainMonthly) +
      Number(config.insuranceMonthly)

    // Calculate battery and charger costs (using average 8-hour rental for fixed costs)
    let batteryCosts = 0
    let chargerCosts = 0
    
    try {
      // Calculate battery costs for an average 8-hour rental (ROAD category as default)
      const batteryCostResult = await calculateBatteryCosts(8, "ROAD", Number(config.laborRatePerHour || 20))
      batteryCosts = batteryCostResult.totalCost
      
      // Calculate charger costs
      const chargerCostResult = await calculateChargerCosts(Number(config.monthlyRentalsTarget || 4))
      chargerCosts = chargerCostResult.totalChargerCost
    } catch (error) {
      console.error("Error calculating battery/charger costs:", error)
      // Continue with 0 if calculation fails
    }

    return NextResponse.json({
      config: {
        ...config,
        holidayMultiplier: config.holidayMultiplier,
        smsCostPerMessage: config.smsCostPerMessage,
        totalMonthlyRecurring,
        batteryCostsPerRental: batteryCosts,
        chargerCostsPerRental: chargerCosts,
        totalBatteryChargerCostsPerRental: batteryCosts + chargerCosts,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    
    // Check for Prisma model/table not found error
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (
      errorMessage.includes("fixedCostsConfig") ||
      errorMessage.includes("fixed_costs_config") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Cannot read properties of undefined")
    ) {
      return NextResponse.json(
        {
          error: "Database table not found. Please run: npm run db:generate && npm run db:push",
          hint: "The FixedCostsConfig table needs to be created in the database. Run these commands:",
          commands: [
            "npm run db:generate",
            "npm run db:push"
          ],
        },
        { status: 503 }
      )
    }
    
    console.error("Error updating fixed costs config:", error)
    return NextResponse.json(
      {
        error: "Failed to update fixed costs configuration",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

