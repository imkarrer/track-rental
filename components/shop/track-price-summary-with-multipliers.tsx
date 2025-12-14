"use client"

import { TrackPriceSummary } from "./track-price-summary"
import { DayMultipliersDisplay } from "./day-multipliers-display"
import { useState, useEffect } from "react"

interface TrackPriceSummaryWithMultipliersProps {
  trackId: string
  trackBasePrice: number
}

export function TrackPriceSummaryWithMultipliers({
  trackId,
  trackBasePrice,
}: TrackPriceSummaryWithMultipliersProps) {
  const [additionalCarsPrice, setAdditionalCarsPrice] = useState(0)

  // Listen for price updates from TrackPriceSummary
  useEffect(() => {
    const handlePriceUpdate = (e: CustomEvent) => {
      setAdditionalCarsPrice(e.detail.additionalCarsPrice || 0)
    }

    window.addEventListener("priceSummaryUpdate", handlePriceUpdate as EventListener)

    return () => {
      window.removeEventListener("priceSummaryUpdate", handlePriceUpdate as EventListener)
    }
  }, [])

  return (
    <>
      <TrackPriceSummary trackId={trackId} trackBasePrice={trackBasePrice} />
      <DayMultipliersDisplay
        trackBasePrice={trackBasePrice}
        additionalCarsPrice={additionalCarsPrice}
      />
    </>
  )
}

