import { NextRequest, NextResponse } from "next/server"
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3"
import { s3Client, storageConfig } from "@/lib/storage/config"

/**
 * GET /api/storage/images
 * List all images in storage
 */
export async function GET(request: NextRequest) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: storageConfig.bucket,
    })

    const response = await s3Client.send(command)

    const images = (response.Contents || []).map((object) => {
      if (!object.Key) return null

      return {
        key: object.Key,
        url: `${storageConfig.endpoint}/${storageConfig.bucket}/${object.Key}`,
        size: object.Size,
        lastModified: object.LastModified,
      }
    }).filter(Boolean)

    return NextResponse.json({
      images,
      count: images.length,
      bucket: storageConfig.bucket,
    })
  } catch (error: any) {
    console.error("Error listing images:", error)
    return NextResponse.json(
      { error: error.message || "Failed to list images" },
      { status: 500 }
    )
  }
}

