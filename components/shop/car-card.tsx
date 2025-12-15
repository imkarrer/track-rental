import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CarCardProps {
  id: string
  name: string
  description?: string | null
  category: "ROAD" | "OFFROAD"
  type: string
  basePricePerDay: number
  stockQuantity: number
  imageUrls: string[]
}

export function CarCard({
  id,
  name,
  description,
  category,
  type,
  basePricePerDay,
  stockQuantity,
  imageUrls,
}: CarCardProps) {
  const imageUrl = imageUrls && imageUrls.length > 0 ? imageUrls[0] : "/placeholder-car.jpg"

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-48 w-full bg-gray-100 overflow-hidden flex items-center justify-center">
        {imageUrl.startsWith("http") || imageUrl.startsWith("/") ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-contain object-center"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 bg-gray-100">
            No Image
          </div>
        )}
      </div>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-xl">{name}</CardTitle>
          <span className={`text-xs px-2 py-1 rounded-full ${
            category === "ROAD" 
              ? "bg-blue-100 text-blue-800" 
              : "bg-green-100 text-green-800"
          }`}>
            {category === "ROAD" ? "Road" : "Offroad"}
          </span>
        </div>
        <CardDescription>
          {description || `${type} RC car`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-600">
            Type: {type} | Stock: {stockQuantity}
          </p>
          <p className="text-2xl font-bold text-blue-600">
            ${Number(basePricePerDay).toFixed(2)}/day
          </p>
        </div>
        <Link href={`/shop/cars/${id}`}>
          <Button className="w-full">View Details</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

