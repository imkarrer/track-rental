import { NextRequest, NextResponse } from "next/server"
import { calculateMultiDayPricing, MultiDayPricingInput } from "@/lib/pricing/multi-day"
import { z } from "zod"
import { toUTCDate, toDateStringUTC } from "@/lib/date/format"

const multiDayPricingSchema = z.object({
  trackBasePrice: z.number().positive(),
  startDate: z.string(),
  endDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  setupTimeMinutes: z.number().int().nonnegative(),
  distanceFromBase: z.number().nonnegative(),
  selectedCars: z.array(
    z.object({
      carId: z.string(),
      basePricePerDay: z.number().nonnegative(),
      quantity: z.number().int().positive(),
    })
  ),
  taxRate: z.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = multiDayPricingSchema.parse(body)

    const startDate = toUTCDate(validatedData.startDate)
    const endDate = toUTCDate(validatedData.endDate)
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 })
    }

    const input: MultiDayPricingInput = {
      trackBasePrice: validatedData.trackBasePrice,
      startDate,
      endDate,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      setupTimeMinutes: validatedData.setupTimeMinutes,
      distanceFromBase: validatedData.distanceFromBase,
      selectedCars: validatedData.selectedCars,
      taxRate: validatedData.taxRate,
    }

    const result = await calculateMultiDayPricing(input)

    // Convert dates to strings for JSON response
    const resultWithStringDates = {
      ...result,
      days: result.days.map((day) => ({
        ...day,
        // Preserve calendar day as received (local-based date)
        date: toDateStringUTC(day.date),
      })),
    }

    return NextResponse.json(resultWithStringDates)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error calculating multi-day pricing:", error)
    return NextResponse.json(
      { error: "Failed to calculate multi-day pricing" },
      { status: 500 }
    )
  }
}

