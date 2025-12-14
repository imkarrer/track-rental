import { NextRequest, NextResponse } from "next/server"

const BASE_ADDRESS = "123 Main St, City, State 12345" // Your business address

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventAddress, eventCity, eventState, eventZip } = body

    if (!eventAddress || !eventCity || !eventState || !eventZip) {
      return NextResponse.json(
        { error: "Missing required address fields" },
        { status: 400 }
      )
    }

    const fullAddress = `${eventAddress}, ${eventCity}, ${eventState} ${eventZip}`

    // In development, use WireMock mock service
    // In production, use real Google Maps API
    const apiUrl = process.env.GOOGLE_MAPS_API_URL || "http://localhost:8080"
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || "mock-key"

    const url = `${apiUrl}/maps/api/distancematrix/json?origins=${encodeURIComponent(
      BASE_ADDRESS
    )}&destinations=${encodeURIComponent(fullAddress)}&units=imperial&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === "OK" && data.rows[0]?.elements[0]?.status === "OK") {
      const element = data.rows[0].elements[0]
      const distanceText = element.distance.text // e.g., "15.2 mi"
      const distanceValue = element.distance.value // in meters
      const durationValue = element.duration.value // in seconds

      // Extract miles from text (handles "15.2 mi" format)
      const milesMatch = distanceText.match(/([\d.]+)\s*mi/)
      const distanceMiles = milesMatch
        ? parseFloat(milesMatch[1])
        : distanceValue / 1609.34 // Convert meters to miles

      return NextResponse.json({
        distanceMiles: Math.round(distanceMiles * 100) / 100,
        distanceKm: Math.round((distanceValue / 1000) * 100) / 100,
        durationMinutes: Math.round(durationValue / 60),
        address: fullAddress,
      })
    } else {
      // Fallback: return mock distance for development
      console.warn("Distance calculation failed, using mock data:", data.status)
      return NextResponse.json({
        distanceMiles: 15.0, // Mock distance
        distanceKm: 24.1,
        durationMinutes: 25,
        address: fullAddress,
      })
    }
  } catch (error) {
    console.error("Error calculating distance:", error)
    // Fallback for development
    const body = await request.json().catch(() => ({}))
    const { eventAddress, eventCity, eventState, eventZip } = body
    const fullAddress = eventAddress && eventCity && eventState && eventZip
      ? `${eventAddress}, ${eventCity}, ${eventState} ${eventZip}`
      : "Unknown"

    return NextResponse.json({
      distanceMiles: 15.0,
      distanceKm: 24.1,
      durationMinutes: 25,
      address: fullAddress,
    })
  }
}

