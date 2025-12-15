import { describe, it, expect, afterEach, vi } from "vitest"
import { calculateDistance } from "@/lib/distance/calculate"
import { validateTrackFitsInSpace } from "@/lib/validation/space"

describe("distance calculation", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns distance data from the API response", async () => {
    const mockResponse = {
      distanceMiles: 12.5,
      distanceKm: 20.1,
      durationMinutes: 30,
      address: "123 Main St, Testville, TS 12345",
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    const result = await calculateDistance("123 Main St", "Testville", "TS", "12345")

    expect(fetchMock).toHaveBeenCalledWith("/api/distance/calculate", expect.objectContaining({
      method: "POST",
    }))
    expect(result).toEqual(mockResponse)
  })

  it("falls back to default values when the API call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch)

    const result = await calculateDistance("1 Test St", "Fallback", "FB", "90210")

    expect(result.distanceMiles).toBeGreaterThan(0)
    expect(result.durationMinutes).toBeGreaterThan(0)
    expect(result.address).toContain("Fallback")
    expect(result.address).toContain("FB")
  })
})

describe("validateTrackFitsInSpace", () => {
  it("returns fit=true with a friendly message when the track fits", () => {
    const result = validateTrackFitsInSpace(20, 10, 25, 12)

    expect(result.fits).toBe(true)
    expect(result.lengthFit).toBe(true)
    expect(result.widthFit).toBe(true)
    expect(result.message).toContain("fits")
  })

  it("describes which dimensions do not fit when space is too small", () => {
    const result = validateTrackFitsInSpace(30, 15, 20, 10)

    expect(result.fits).toBe(false)
    expect(result.lengthFit).toBe(false)
    expect(result.widthFit).toBe(false)
    expect(result.message).toContain("Length")
    expect(result.message).toContain("Width")
  })
})


