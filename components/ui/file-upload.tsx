"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageCropper } from "@/components/ui/image-cropper"

interface FileUploadProps {
  onUploadComplete: (urls: string[]) => void
  folder?: "tracks" | "cars"
  multiple?: boolean
  existingUrls?: string[]
  enableCrop?: boolean
  aspectRatio?: number | undefined
}

export function FileUpload({
  onUploadComplete,
  folder = "tracks",
  multiple = false,
  existingUrls = [],
  enableCrop = true,
  aspectRatio = undefined, // Free aspect ratio by default
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(existingUrls)
  const [error, setError] = useState<string>("")
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0] // Handle first file for cropping
    setPendingFile(file)

    // Create preview URL for cropping
    if (enableCrop) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string
        setImageToCrop(imageUrl)
        setCurrentImageUrl(imageUrl)
      }
      reader.readAsDataURL(file)
    } else {
      // Upload directly without cropping
      await uploadFile(file)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const uploadFile = async (file: File, croppedImageUrl?: string) => {
    setUploading(true)
    setError("")

    try {
      const formData = new FormData()
      // If we have a cropped image, convert it to a file
      if (croppedImageUrl) {
        const response = await fetch(croppedImageUrl)
        const blob = await response.blob()
        // Use PNG for cropped images to preserve transparency
        const fileName = file.name.replace(/\.[^/.]+$/, "") + ".png"
        const croppedFile = new File([blob], fileName, { type: "image/png" })
        formData.append("file", croppedFile)
      } else {
        formData.append("file", file)
      }
      formData.append("folder", folder)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        const errorMessage = error.error || "Upload failed"
        const hint = error.hint ? `\n\n${error.hint}` : ""
        throw new Error(errorMessage + hint)
      }

      const data = await uploadResponse.json()
      const newUrls = [...uploadedUrls, data.url]
      setUploadedUrls(newUrls)
      onUploadComplete(newUrls)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed"
      setError(errorMessage)
      console.error("File upload error:", err)
    } finally {
      setUploading(false)
      setPendingFile(null)
    }
  }

  const handleCropComplete = async (croppedImageUrl: string) => {
    setImageToCrop(null)
    if (pendingFile) {
      await uploadFile(pendingFile, croppedImageUrl)
    }
  }

  const handleCropCancel = () => {
    setImageToCrop(null)
    setPendingFile(null)
  }

  const removeUrl = (urlToRemove: string) => {
    const newUrls = uploadedUrls.filter((url) => url !== urlToRemove)
    setUploadedUrls(newUrls)
    onUploadComplete(newUrls)
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Images {multiple && "(multiple allowed)"}
          </label>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple={multiple}
            onChange={handleFileChange}
            disabled={uploading}
          />
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
          {uploading && (
            <p className="text-sm text-gray-500 mt-1">Uploading...</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Max file size: 5MB. Allowed: JPEG, PNG, WebP
            {enableCrop && " • You'll be able to crop the image after selection"}
          </p>
        </div>

        {uploadedUrls.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploaded Images:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {uploadedUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <div className="w-full h-48 bg-gray-100 rounded-lg border border-gray-200 shadow-sm p-2 flex items-center justify-center">
                    <img
                      src={url}
                      alt={`Upload ${index + 1}`}
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUrl(url)}
                    className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm font-bold shadow-lg"
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {imageToCrop && (
        <ImageCropper
          image={currentImageUrl || imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={aspectRatio}
          onImageUpdate={(newImageUrl) => {
            setCurrentImageUrl(newImageUrl)
            setImageToCrop(newImageUrl)
          }}
        />
      )}
    </>
  )
}

