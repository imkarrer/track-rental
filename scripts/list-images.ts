import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3"

const s3Client = new S3Client({
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  },
  forcePathStyle: true,
})

async function listImages() {
  const bucketName = "rc-track-rental"

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
    })

    const response = await s3Client.send(command)

    if (!response.Contents || response.Contents.length === 0) {
      console.log("No images found in bucket")
      return
    }

    console.log(`\nFound ${response.Contents.length} image(s) in bucket:\n`)
    console.log("=" .repeat(80))

    response.Contents.forEach((object, index) => {
      if (!object.Key) return

      const url = `http://localhost:9000/${bucketName}/${object.Key}`
      const sizeKB = ((object.Size || 0) / 1024).toFixed(2)
      const lastModified = object.LastModified?.toLocaleString() || "Unknown"

      console.log(`\n${index + 1}. ${object.Key}`)
      console.log(`   URL: ${url}`)
      console.log(`   Size: ${sizeKB} KB`)
      console.log(`   Modified: ${lastModified}`)
      console.log(`   Direct Link: ${url}`)
    })

    console.log("\n" + "=".repeat(80))
    console.log("\n💡 To view images:")
    console.log("   1. Open MinIO Console: http://localhost:9001")
    console.log("   2. Login: minioadmin / minioadmin")
    console.log("   3. Navigate to 'rc-track-rental' bucket")
    console.log("   4. Click on any image to view/download")
    console.log("\n💡 Or open URLs directly in your browser")
  } catch (error: any) {
    console.error("Error listing images:", error.message)
    console.error("\nMake sure:")
    console.error("  1. MinIO is running: docker-compose ps minio")
    console.error("  2. Bucket exists: npm run storage:init")
  }
}

listImages()

