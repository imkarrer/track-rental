import { S3Client } from "@aws-sdk/client-s3"

/**
 * Storage provider type
 * - 's3': Use S3-compatible storage (MinIO, AWS S3, Cloudflare R2, etc.)
 * - 'vercel-blob': Use Vercel Blob storage
 */
export type StorageProvider = 's3' | 'vercel-blob'

/**
 * Get the storage provider from environment variables
 * Defaults to 's3' for local development, 'vercel-blob' in production on Vercel
 */
export function getStorageProvider(): StorageProvider {
  // Explicit override via environment variable
  if (process.env.STORAGE_PROVIDER === 'vercel-blob') {
    return 'vercel-blob'
  }
  if (process.env.STORAGE_PROVIDER === 's3') {
    return 's3'
  }

  // Auto-detect: If on Vercel and BLOB_READ_WRITE_TOKEN is set, use Vercel Blob
  if (process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN) {
    return 'vercel-blob'
  }

  // Default to S3/MinIO for local development
  return 's3'
}

// MinIO/S3 configuration (only used when provider is 's3')
const useMinIO = process.env.USE_MINIO !== "false" // Default to true for local dev

export const s3Client = new S3Client({
  endpoint: useMinIO
    ? process.env.S3_ENDPOINT || "http://localhost:9000"
    : undefined,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
  },
  forcePathStyle: useMinIO, // Required for MinIO
})

export const storageConfig = {
  bucket: process.env.S3_BUCKET || "rc-track-rental",
  endpoint: useMinIO
    ? process.env.S3_ENDPOINT || "http://localhost:9000"
    : undefined,
  publicUrl: useMinIO
    ? process.env.S3_PUBLIC_URL || "http://localhost:9000/rc-track-rental"
    : process.env.S3_PUBLIC_URL || "",
}

