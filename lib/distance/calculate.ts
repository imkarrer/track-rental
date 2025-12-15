/**
 * Calculate distance between two addresses using Google Maps Distance Matrix API
 * This function calls a Next.js API route to avoid CORS issues
 */

export interface DistanceResult {
  distanceMiles: number
  distanceKm: number
  durationMinutes: number
  address: string
}

/**
 * Calculate distance from base address to event address
 * Calls Next.js API route to avoid CORS issues with WireMock/Google Maps API
 */
export async function calculateDistance(
  eventAddress: string,
  eventCity: string,
  eventState: string,
  eventZip: string
): Promise<DistanceResult> {
  try {
    const response = await fetch("/api/distance/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventAddress,
        eventCity,
        eventState,
        eventZip,
      }),
    })

    if (!response.ok) {
      throw new Error(`Distance API returned ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error calculating distance:", error)
    // Fallback for development
    const fullAddress = `${eventAddress}, ${eventCity}, ${eventState} ${eventZip}`
    return {
      distanceMiles: 15.0,
      distanceKm: 24.1,
      durationMinutes: 25,
      address: fullAddress,
    }
  }
}

