import 'server-only'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PrismaClient constructor doesn't validate DATABASE_URL immediately,
// but it will fail when making queries if DATABASE_URL is missing.
// Pages that use Prisma should be marked as dynamic to prevent prerendering.
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

