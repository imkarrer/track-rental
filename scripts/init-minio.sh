#!/bin/bash
# Initialize MinIO bucket for image storage

echo "Initializing MinIO bucket..."

# Wait for MinIO to be ready
until curl -f http://localhost:9000/minio/health/live 2>/dev/null; do
  echo "Waiting for MinIO to be ready..."
  sleep 2
done

# Install mc (MinIO Client) if not available
if ! command -v mc &> /dev/null; then
  echo "Installing MinIO Client..."
  wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
  chmod +x /tmp/mc
  MC=/tmp/mc
else
  MC=mc
fi

# Configure MinIO client
$MC alias set local http://localhost:9000 minioadmin minioadmin

# Create bucket if it doesn't exist
$MC mb local/rc-track-rental --ignore-existing || true

# Set bucket policy to public read (for development)
$MC anonymous set download local/rc-track-rental || true

echo "✅ MinIO bucket 'rc-track-rental' initialized!"
echo "   Access MinIO Console at: http://localhost:9001"
echo "   Login: minioadmin / minioadmin"

