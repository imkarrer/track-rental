import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TrackCardProps {
  id: string
  name: string
  description?: string | null
  category: "ROAD" | "OFFROAD"
  basePrice: number
  length: number
  width: number
  imageUrls: string[]
}

export function TrackCard({
  id,
  name,
  description,
  category,
  basePrice,
  length,
  width,
  imageUrls,
}: TrackCardProps) {
  const imageUrl = imageUrls && imageUrls.length > 0 ? imageUrls[0] : "/placeholder-track.jpg"

  return (
    <Card data-testid={`track-card-${id}`} className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-64 w-full bg-gray-100 overflow-hidden flex items-center justify-center">
        {imageUrl.startsWith("http") || imageUrl.startsWith("/") ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-contain object-center transition-transform duration-300 hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 bg-gray-100">
            <span>No Image</span>
          </div>
        )}
      </div>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-xl">{name}</CardTitle>
          <span className={`text-xs px-2 py-1 rounded-full ${
            (category?.toUpperCase() || "") === "ROAD"
              ? "bg-blue-100 text-blue-800" 
              : "bg-green-100 text-green-800"
          }`}>
            {(category?.toUpperCase() || "") === "ROAD" ? "Road" : "Offroad"}
          </span>
        </div>
        <CardDescription>
          {description || "Premium RC track for your event"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-600">
            Size: {length}ft × {width}ft
          </p>
          <p className="text-2xl font-bold text-blue-600">
            ${Number(basePrice).toFixed(2)}
          </p>
        </div>
        <Link href={`/shop/tracks/${id}`}>
          <Button data-testid={`track-view-details-button-${id}`} className="w-full">View Details</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

