import { NextRequest, NextResponse } from "next/server"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { s3Client, storageConfig } from "@/lib/storage/config"

/**
 * GET /api/storage/images/[key]
 * Get/download a specific image from storage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const decodedKey = decodeURIComponent(key)

    const command = new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: decodedKey,
    })

    const response = await s3Client.send(command)

    if (!response.Body) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      )
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    // @ts-ignore - Body is a stream
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    // Determine content type
    const contentType = response.ContentType || "image/png"
    const extension = decodedKey.split(".").pop()?.toLowerCase()
    let finalContentType = contentType

    if (extension === "png") finalContentType = "image/png"
    else if (extension === "jpg" || extension === "jpeg") finalContentType = "image/jpeg"
    else if (extension === "webp") finalContentType = "image/webp"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": finalContentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error: any) {
    console.error("Error getting image:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get image" },
      { status: 500 }
    )
  }
}

