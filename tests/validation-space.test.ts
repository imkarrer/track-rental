import { describe, it, expect } from "vitest"
import { validateTrackFitsInSpace, SpaceValidation } from "@/lib/validation/space"

describe("validateTrackFitsInSpace", () => {
  it("returns fits=true when track fits in available space", () => {
    const result = validateTrackFitsInSpace(50, 30, 60, 40)
    
    expect(result.fits).toBe(true)
    expect(result.lengthFit).toBe(true)
    expect(result.widthFit).toBe(true)
    expect(result.message).toBe("Track fits in the available space")
  })

  it("returns fits=true when dimensions are exactly equal", () => {
    const result = validateTrackFitsInSpace(50, 30, 50, 30)
    
    expect(result.fits).toBe(true)
    expect(result.lengthFit).toBe(true)
    expect(result.widthFit).toBe(true)
  })

  it("returns fits=false when length is insufficient", () => {
    const result = validateTrackFitsInSpace(50, 30, 40, 40)
    
    expect(result.fits).toBe(false)
    expect(result.lengthFit).toBe(false)
    expect(result.widthFit).toBe(true)
    expect(result.message).toContain("Length: Track needs 50ft but only 40ft available")
    expect(result.message).toContain("10.0ft short")
  })

  it("returns fits=false when width is insufficient", () => {
    const result = validateTrackFitsInSpace(50, 35, 60, 30)
    
    expect(result.fits).toBe(false)
    expect(result.lengthFit).toBe(true)
    expect(result.widthFit).toBe(false)
    expect(result.message).toContain("Width: Track needs 35ft but only 30ft available")
    expect(result.message).toContain("5.0ft short")
  })

  it("returns fits=false when both dimensions are insufficient", () => {
    const result = validateTrackFitsInSpace(60, 40, 50, 30)
    
    expect(result.fits).toBe(false)
    expect(result.lengthFit).toBe(false)
    expect(result.widthFit).toBe(false)
    expect(result.message).toContain("Length:")
    expect(result.message).toContain("Width:")
  })

  it("handles decimal dimensions correctly", () => {
    const result = validateTrackFitsInSpace(50.5, 30.5, 50, 30)
    
    expect(result.fits).toBe(false)
    expect(result.message).toContain("0.5ft short")
  })
})

