"use client"

import { useState, useCallback, useEffect } from "react"
import Cropper from "react-easy-crop"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ImageCropperProps {
  image: string
  onCropComplete: (croppedImage: string) => void
  onCancel: () => void
  aspectRatio?: number | undefined
  onImageUpdate?: (newImageUrl: string) => void
}

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = undefined, // Free aspect ratio - no constraint
  onImageUpdate,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [autoCropping, setAutoCropping] = useState(false)
  const [currentImage, setCurrentImage] = useState<string>(image)

  // Update currentImage when image prop changes (initial load only)
  useEffect(() => {
    setCurrentImage(image)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
    setCroppedAreaPixels(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount, not when image prop changes

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropCompleteCallback = useCallback(
    (croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const onMediaLoaded = useCallback((mediaSize: { width: number; height: number }) => {
    setImageSize(mediaSize)
  }, [])

  const createImage = useCallback((url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener("load", () => resolve(image))
      image.addEventListener("error", (error) => reject(error))
      image.src = url
    }), [])

  /**
   * Auto-crop white borders from image
   * Scans edges to find the bounding box of non-white content
   */
  const autoCropWhiteBorders = useCallback(async () => {
    console.log("Starting auto-crop, currentImage:", currentImage)
    setAutoCropping(true)
    try {
      const img = await createImage(currentImage)
      console.log("Image loaded, dimensions:", img.width, "x", img.height)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      
      if (!ctx) {
        throw new Error("No 2d context")
      }

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Threshold for "white" (adjustable, 0-255)
      // Using 240 to catch off-white and very light colors
      const whiteThreshold = 240
      const alphaThreshold = 10 // Ignore transparent pixels

      // Find top border
      let top = 0
      for (let y = 0; y < canvas.height; y++) {
        let isWhiteRow = true
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const a = data[idx + 3]
          
          if (a < alphaThreshold) continue // Skip transparent
          if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
            isWhiteRow = false
            break
          }
        }
        if (!isWhiteRow) {
          top = y
          break
        }
      }

      // Find bottom border
      let bottom = canvas.height - 1
      for (let y = canvas.height - 1; y >= 0; y--) {
        let isWhiteRow = true
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const a = data[idx + 3]
          
          if (a < alphaThreshold) continue
          if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
            isWhiteRow = false
            break
          }
        }
        if (!isWhiteRow) {
          bottom = y
          break
        }
      }

      // Find left border
      let left = 0
      for (let x = 0; x < canvas.width; x++) {
        let isWhiteCol = true
        for (let y = 0; y < canvas.height; y++) {
          const idx = (y * canvas.width + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const a = data[idx + 3]
          
          if (a < alphaThreshold) continue
          if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
            isWhiteCol = false
            break
          }
        }
        if (!isWhiteCol) {
          left = x
          break
        }
      }

      // Find right border
      let right = canvas.width - 1
      for (let x = canvas.width - 1; x >= 0; x--) {
        let isWhiteCol = true
        for (let y = 0; y < canvas.height; y++) {
          const idx = (y * canvas.width + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const a = data[idx + 3]
          
          if (a < alphaThreshold) continue
          if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
            isWhiteCol = false
            break
          }
        }
        if (!isWhiteCol) {
          right = x
          break
        }
      }

      // Add small padding to avoid cutting too close (optional)
      const padding = 2
      const cropX = Math.max(0, left - padding)
      const cropY = Math.max(0, top - padding)
      const cropWidth = Math.min(canvas.width - cropX, right - left + padding * 2)
      const cropHeight = Math.min(canvas.height - cropY, bottom - top + padding * 2)

      console.log("Auto-crop bounds:", { top, bottom, left, right, cropX, cropY, cropWidth, cropHeight })
      
      // Validate crop dimensions
      if (cropWidth <= 0 || cropHeight <= 0 || cropWidth > canvas.width || cropHeight > canvas.height) {
        throw new Error("Invalid crop dimensions. Image may be entirely white or too small.")
      }

      // Create cropped version
      const croppedCanvas = document.createElement("canvas")
      const croppedCtx = croppedCanvas.getContext("2d", { alpha: true })
      
      if (!croppedCtx) {
        throw new Error("No 2d context")
      }

      croppedCanvas.width = cropWidth
      croppedCanvas.height = cropHeight
      croppedCtx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      )

      // Convert to blob URL and update the image source
      const blob = await new Promise<Blob>((resolve) => {
        croppedCanvas.toBlob((b) => {
          if (b) resolve(b)
          else throw new Error("Failed to create blob")
        }, "image/png")
      })

      const newImageUrl = URL.createObjectURL(blob)
      
      // Update the image source to the auto-cropped version
      // We'll need to trigger a re-render with the new image
      // For now, we'll update the image state
      const newImage = new Image()
      newImage.src = newImageUrl
      await new Promise((resolve) => {
        newImage.onload = resolve
      })

      // Reset zoom and crop to show the new image
      setZoom(1)
      setCrop({ x: 0, y: 0 })
      setCroppedAreaPixels(null)
      
      // Update the displayed image
      setCurrentImage(newImageUrl)
      
      // Notify parent component if callback provided
      if (onImageUpdate) {
        onImageUpdate(newImageUrl)
      }
      
      console.log("Auto-crop completed, new image URL:", newImageUrl)
      return newImageUrl
    } catch (error) {
      console.error("Auto-crop error:", error)
      throw error
    } finally {
      setAutoCropping(false)
    }
  }, [currentImage, createImage, onImageUpdate])

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any,
    zoom: number
  ): Promise<string> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { alpha: true }) // Enable transparency

    if (!ctx) {
      throw new Error("No 2d context")
    }

    // croppedAreaPixels from react-easy-crop gives coordinates in ORIGINAL image space
    // These dimensions already respect the aspect ratio (e.g., 16:9)
    // We use these directly as the output dimensions
    const outputWidth = Math.round(pixelCrop.width)
    const outputHeight = Math.round(pixelCrop.height)

    // Set canvas to exact crop dimensions (maintains aspect ratio)
    canvas.width = outputWidth
    canvas.height = outputHeight

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // croppedAreaPixels.x and .y are in original image coordinates
    // Calculate the source rectangle in the original image
    const sourceX = Math.max(0, Math.round(pixelCrop.x))
    const sourceY = Math.max(0, Math.round(pixelCrop.y))
    const sourceWidth = Math.min(
      image.width - sourceX,
      Math.round(pixelCrop.width)
    )
    const sourceHeight = Math.min(
      image.height - sourceY,
      Math.round(pixelCrop.height)
    )

    // Calculate destination position in canvas
    // If crop extends beyond image boundaries (negative x/y), offset the destination
    const destX = pixelCrop.x < 0 ? Math.round(-pixelCrop.x) : 0
    const destY = pixelCrop.y < 0 ? Math.round(-pixelCrop.y) : 0

    // When zoomed out, the image is smaller than the crop area
    // We need to scale the destination size by zoom
    const destWidth = sourceWidth * zoom
    const destHeight = sourceHeight * zoom

    // Draw the image portion
    if (sourceWidth > 0 && sourceHeight > 0) {
      ctx.drawImage(
        image,
        sourceX, // Source X in original image
        sourceY, // Source Y in original image
        sourceWidth, // Source width
        sourceHeight, // Source height
        destX, // Destination X in canvas
        destY, // Destination Y in canvas
        destWidth, // Destination width (scaled by zoom)
        destHeight // Destination height (scaled by zoom)
      )
    }

    // Areas outside the image remain transparent (already cleared)

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve("")
            return
          }
          const url = URL.createObjectURL(blob)
          resolve(url)
        },
        "image/png", // Use PNG to preserve transparency
        1.0 // Quality (PNG is lossless)
      )
    })
  }

  const handleSave = async () => {
    if (!croppedAreaPixels) {
      onCropComplete(currentImage) // Use current image if no crop
      return
    }

    try {
      const croppedImage = await getCroppedImg(currentImage, croppedAreaPixels, zoom)
      onCropComplete(croppedImage)
    } catch (error) {
      console.error("Error cropping image:", error)
      onCropComplete(currentImage) // Fallback to current image
    }
  }

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>
            Adjust the crop area and zoom to frame your image perfectly
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                console.log("Auto-crop button clicked, current image:", currentImage)
                const result = await autoCropWhiteBorders()
                console.log("Auto-crop completed, result:", result)
              } catch (error) {
                console.error("Auto-crop failed:", error)
                alert(`Auto-crop failed: ${error instanceof Error ? error.message : "Unknown error"}`)
              }
            }}
            disabled={autoCropping}
          >
            {autoCropping ? "Auto-Cropping..." : "Auto-Crop White Borders"}
          </Button>
          {autoCropping && (
            <span className="text-sm text-gray-500 flex items-center">
              Removing white borders...
            </span>
          )}
        </div>
        <div className="relative w-full h-[400px] bg-gray-900 rounded-lg overflow-hidden">
          <div className="absolute inset-0 bg-checkerboard" 
               style={{
                 backgroundImage: `
                   linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
                   linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
                   linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
                   linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
                 `,
                 backgroundSize: '20px 20px',
                 backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
               }}
          />
          <Cropper
            image={currentImage}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio} // undefined = free aspect ratio
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            onMediaLoaded={onMediaLoaded}
            cropShape="rect"
            showGrid={true}
            restrictPosition={false} // Allow positioning outside image bounds
          />
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Zoom: {zoom.toFixed(2)}x {zoom < 1 && "(zoomed out - transparent area will be added)"}
            </label>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.1x (Zoom Out)</span>
              <span>1x (Normal)</span>
              <span>3x (Zoom In)</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Aspect Ratio: {aspectRatio ? (aspectRatio === 16 / 9 ? "16:9" : aspectRatio === 4 / 3 ? "4:3" : `Custom (${aspectRatio.toFixed(2)})`) : "Free (unlocked)"}</p>
            <p>• Drag to reposition the image</p>
            <p>• Resize the crop area by dragging corners/edges</p>
            <p>• Zoom out to add transparent padding around the image</p>
            <p>• Transparent areas will be preserved in the final PNG image</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Cropped Image</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

