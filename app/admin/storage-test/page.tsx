"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface ImageInfo {
  key: string
  url: string
  size: number
  lastModified: string
}

export default function StorageTestPage() {
  const [images, setImages] = useState<ImageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/storage/images")
      if (!response.ok) {
        throw new Error("Failed to fetch images")
      }
      const data = await response.json()
      setImages(data.images || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load images")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Loading images...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchImages} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Storage Images Test</h1>
        <p className="text-gray-600">
          View all images stored in MinIO object storage
        </p>
        <Button onClick={fetchImages} className="mt-4">
          Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Image List</CardTitle>
          <CardDescription>
            Found {images.length} image(s) in storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {images.map((img, index) => (
              <div key={index} className="p-2 border rounded">
                <p className="font-mono text-sm">{img.key}</p>
                <p className="text-xs text-gray-500">
                  Size: {(img.size / 1024).toFixed(2)} KB
                </p>
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  {img.url}
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image Preview</CardTitle>
          <CardDescription>
            Testing image display with Next.js Image component
          </CardDescription>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-gray-500">No images found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((img, index) => (
                <div key={index} className="space-y-2">
                  <div className="relative h-48 w-full bg-gray-100 rounded-lg overflow-hidden border">
                    <Image
                      src={img.url}
                      alt={img.key}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{img.key}</p>
                  <div className="flex gap-2">
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Direct URL
                    </a>
                    <a
                      href={`/api/storage/images/${encodeURIComponent(img.key)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      API Proxy
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

