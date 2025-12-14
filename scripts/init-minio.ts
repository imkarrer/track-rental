import { S3Client, CreateBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3"
import * as http from "http"

const s3Client = new S3Client({
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  },
  forcePathStyle: true,
})

async function initBucket() {
  const bucketName = "rc-track-rental"

  try {
    // Create bucket
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
      })
    )
    console.log(`✅ Bucket "${bucketName}" created or already exists`)

    // Set public read policy (for development)
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    }

    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(policy),
      })
    )
    console.log(`✅ Public read policy set for "${bucketName}"`)
    console.log("\n📦 MinIO Setup Complete!")
    console.log("   Console: http://localhost:9001")
    console.log("   Login: minioadmin / minioadmin")
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "BucketAlreadyOwnedByYou") {
      console.log(`✅ Bucket "${bucketName}" already exists`)
    } else {
      console.error("Error initializing bucket:", error)
      process.exit(1)
    }
  }
}

// Wait for MinIO to be ready
async function waitForMinIO() {
  const maxAttempts = 30
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get("http://localhost:9000/minio/health/live", (res) => {
          if (res.statusCode === 200) {
            resolve()
          } else {
            reject(new Error(`Status: ${res.statusCode}`))
          }
        })
        req.on("error", reject)
        req.setTimeout(2000, () => {
          req.destroy()
          reject(new Error("Timeout"))
        })
      })
      return true
    } catch (error) {
      // MinIO not ready yet
    }
    attempts++
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return false
}

async function main() {
  console.log("Waiting for MinIO to be ready...")
  const ready = await waitForMinIO()

  if (!ready) {
    console.error("❌ MinIO is not available. Make sure it's running:")
    console.error("   docker-compose up -d minio")
    process.exit(1)
  }

  await initBucket()
}

main()

