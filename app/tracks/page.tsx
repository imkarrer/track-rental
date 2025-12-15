"use client"

import { useEffect, useState } from "react"
import { TrackCard } from "@/components/shop/track-card"
import { Input } from "@/components/ui/input"

interface Track {
  id: string
  name: string
  description?: string | null
  category: "ROAD" | "OFFROAD"
  basePrice: number
  length: number
  width: number
  imageUrls: string[]
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"ROAD" | "OFFROAD" | "">("")

  const fetchTracks = async () => {
    try {
      const url = categoryFilter
        ? `/api/tracks?category=${encodeURIComponent(categoryFilter)}`
        : "/api/tracks"
      const response = await fetch(url)
      const data = await response.json()
      setTracks(data.tracks || [])
    } catch (error) {
      console.error("Error fetching tracks:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTracks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter])

  const filteredTracks = tracks.filter(
    (track) =>
      track.name.toLowerCase().includes(search.toLowerCase()) ||
      track.description?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
          <span className="text-5xl">🏁</span>
          Tracks
        </h1>
        <p className="text-gray-600 mb-6">
          Browse our selection of premium RC tracks
        </p>

        <div className="flex gap-4 mb-6">
          <Input
            type="text"
            placeholder="🔍 Search tracks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "ROAD" | "OFFROAD" | "")}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="">🏷️ All Categories</option>
            <option value="ROAD">🛣️ Road Tracks</option>
            <option value="OFFROAD">⛰️ Offroad Tracks</option>
          </select>
        </div>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No tracks found</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTracks.map((track) => (
            <TrackCard key={track.id} {...track} />
          ))}
        </div>
      )}
    </div>
  )
}


