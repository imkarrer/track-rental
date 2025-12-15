import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { uploadFile } from "@/lib/storage/upload"

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const formData = await request.formData()
    const file = formData.get("file") as File
    const folder = (formData.get("folder") as string) || "tracks"

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate folder
    if (folder !== "tracks" && folder !== "cars") {
      return NextResponse.json(
        { error: "Invalid folder. Must be 'tracks' or 'cars'" },
        { status: 400 }
      )
    }

    const result = await uploadFile(file, folder as "tracks" | "cars")

    return NextResponse.json({
      url: result.url,
      key: result.key,
    })
  } catch (error) {
    console.error("Upload error:", error)
    
    // Provide user-friendly error messages
    const errorMessage = error instanceof Error ? error.message : "Failed to upload file"
    
    // Check if it's a connection error (S3/MinIO)
    if (errorMessage.includes("Cannot connect to storage service")) {
      return NextResponse.json(
        {
          error: errorMessage,
          hint: "Make sure MinIO is running: docker-compose up -d minio",
        },
        { status: 503 } // Service Unavailable
      )
    }
    
    // Check if it's a bucket error (S3/MinIO)
    if (errorMessage.includes("Storage bucket not found")) {
      return NextResponse.json(
        {
          error: errorMessage,
          hint: "Run: npm run storage:init",
        },
        { status: 503 }
      )
    }
    
    // Check if it's a Vercel Blob token error
    if (errorMessage.includes("BLOB_READ_WRITE_TOKEN")) {
      return NextResponse.json(
        {
          error: errorMessage,
          hint: "Set BLOB_READ_WRITE_TOKEN environment variable in Vercel dashboard",
        },
        { status: 503 }
      )
    }
    
    // Check if it's a Vercel Blob upload error
    if (errorMessage.includes("Vercel Blob upload failed")) {
      return NextResponse.json(
        {
          error: errorMessage,
          hint: "Check your Vercel Blob configuration and token",
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

