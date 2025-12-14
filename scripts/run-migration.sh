#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)
fi

# If DATABASE_URL is still not set, use default
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rc_track_rental"
fi

echo "Using DATABASE_URL: ${DATABASE_URL%:*:*:*}" # Show URL without password

# Run the migration
npx prisma db push

echo "✅ Database schema synced successfully!"

