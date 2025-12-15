import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { s3Client, storageConfig, getStorageProvider, StorageProvider } from "./config"
import { randomUUID } from "crypto"

export interface UploadResult {
  url: string
  key: string
}

/**
 * Upload a file to storage (S3/MinIO or Vercel Blob based on environment)
 */
export async function uploadFile(
  file: File | Blob,
  folder: "tracks" | "cars" = "tracks"
): Promise<UploadResult> {
  const provider = getStorageProvider()

  if (provider === 'vercel-blob') {
    return uploadToVercelBlob(file, folder)
  } else {
    return uploadToS3(file, folder)
  }
}

/**
 * Upload to Vercel Blob (production)
 */
async function uploadToVercelBlob(
  file: File | Blob,
  folder: "tracks" | "cars"
): Promise<UploadResult> {
  // Validate file type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
  const fileType = file instanceof File ? file.type : "image/png"
  
  if (!allowedTypes.includes(fileType)) {
    throw new Error(
      `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
    )
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    throw new Error("File size exceeds 5MB limit")
  }

  // Generate unique filename
  const extension = file instanceof File 
    ? (file.name.split(".").pop() || "png")
    : "png"
  const filename = `${folder}/${randomUUID()}.${extension}`

  try {
    // Dynamic import to avoid bundling Vercel Blob in client-side code
    const { put } = await import("@vercel/blob")
    
    const blob = await put(filename, file, {
      access: "public",
      contentType: fileType,
    })

    return {
      url: blob.url,
      key: filename,
    }
  } catch (error: any) {
    if (error.message?.includes("BLOB_READ_WRITE_TOKEN")) {
      throw new Error(
        "Vercel Blob token not configured. Set BLOB_READ_WRITE_TOKEN environment variable."
      )
    }
    throw new Error(`Vercel Blob upload failed: ${error.message || "Unknown error"}`)
  }
}

/**
 * Upload to S3/MinIO (local development or production S3)
 */
async function uploadToS3(
  file: File | Blob,
  folder: "tracks" | "cars"
): Promise<UploadResult> {
  // Validate file type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
  const fileType = file instanceof File ? file.type : "image/png"
  
  if (!allowedTypes.includes(fileType)) {
    throw new Error(
      `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
    )
  }

  // Note: PNG files preserve transparency, which is important for cropped images

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    throw new Error("File size exceeds 5MB limit")
  }

  // Generate unique filename
  const extension = file instanceof File
    ? (file.name.split(".").pop() || "png")
    : "png"
  const filename = `${folder}/${randomUUID()}.${extension}`
  const key = filename

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload to S3/MinIO
  const command = new PutObjectCommand({
    Bucket: storageConfig.bucket,
    Key: key,
    Body: buffer,
    ContentType: fileType,
    // Note: MinIO doesn't support ACL in the same way as S3
    // We'll set bucket policy instead via init script
  })

  try {
    await s3Client.send(command)
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.name === "NetworkingError" || error.code === "ECONNREFUSED") {
      throw new Error(
        "Cannot connect to storage service. Please ensure MinIO is running: docker-compose up -d minio"
      )
    }
    if (error.name === "NoSuchBucket") {
      throw new Error(
        "Storage bucket not found. Please run: npm run storage:init"
      )
    }
    if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch") {
      throw new Error(
        "Storage authentication failed. Please check your S3 credentials in .env.local"
      )
    }
    // Re-throw with original message for other errors
    throw new Error(`Storage upload failed: ${error.message || error.name || "Unknown error"}`)
  }

  // Return public URL
  // MinIO public URL format: http://localhost:9000/bucket-name/path/to/file
  // S3/R2 format depends on configuration
  const url = storageConfig.publicUrl
    ? `${storageConfig.publicUrl}/${key}`
    : `${storageConfig.endpoint || "http://localhost:9000"}/${storageConfig.bucket}/${key}`

  return {
    url,
    key,
  }
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  files: File[],
  folder: "tracks" | "cars" = "tracks"
): Promise<UploadResult[]> {
  const uploads = files.map((file) => uploadFile(file, folder))
  return Promise.all(uploads)
}

