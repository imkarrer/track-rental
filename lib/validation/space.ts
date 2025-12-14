/**
 * Validate that a track fits in the available space
 */

export interface SpaceValidation {
  fits: boolean
  lengthFit: boolean
  widthFit: boolean
  message: string
}

/**
 * Check if track dimensions fit in available space
 * @param trackLength Track length in feet
 * @param trackWidth Track width in feet
 * @param availableLength Available space length in feet
 * @param availableWidth Available space width in feet
 */
export function validateTrackFitsInSpace(
  trackLength: number,
  trackWidth: number,
  availableLength: number,
  availableWidth: number
): SpaceValidation {
  const lengthFit = availableLength >= trackLength
  const widthFit = availableWidth >= trackWidth
  const fits = lengthFit && widthFit

  let message = ""
  if (fits) {
    message = "Track fits in the available space"
  } else {
    const issues: string[] = []
    if (!lengthFit) {
      issues.push(
        `Length: Track needs ${trackLength}ft but only ${availableLength}ft available (${(trackLength - availableLength).toFixed(1)}ft short)`
      )
    }
    if (!widthFit) {
      issues.push(
        `Width: Track needs ${trackWidth}ft but only ${availableWidth}ft available (${(trackWidth - availableWidth).toFixed(1)}ft short)`
      )
    }
    message = `Track does not fit: ${issues.join(", ")}`
  }

  return {
    fits,
    lengthFit,
    widthFit,
    message,
  }
}

