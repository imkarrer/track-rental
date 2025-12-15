import bcrypt from "bcryptjs"
import { normalizeEmail } from "../lib/auth/email-normalize"
import { createPrismaClient } from "./prisma-client"

const prisma = createPrismaClient()

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.log("Usage: npx tsx scripts/create-admin.ts <email> <password>")
    console.log("Example: npx tsx scripts/create-admin.ts admin@example.com mypassword123")
    process.exit(1)
  }

  const [email, password] = args
  const firstName = args[2] || "Admin"
  const lastName = args[3] || "User"

  // Normalize email
  const norm = normalizeEmail(email)

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { emailCanonical: norm.canonical },
  })

  if (existingUser) {
    // Update existing user to admin
    const passwordHash = await bcrypt.hash(password, 10)
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        role: "ADMIN",
        firstName,
        lastName,
        emailVerified: new Date(), // Auto-verify admin users
      },
    })
    console.log(`✅ Updated user "${norm.original}" to ADMIN role`)
    console.log(`   User ID: ${updatedUser.id}`)
    console.log(`   Email verified: Yes`)
  } else {
    // Create new admin user
    const passwordHash = await bcrypt.hash(password, 10)
    const newUser = await prisma.user.create({
      data: {
        email: norm.original.toLowerCase(),
        emailCanonical: norm.canonical,
        passwordHash,
        firstName,
        lastName,
        role: "ADMIN",
        emailVerified: new Date(), // Auto-verify admin users
      },
    })
    console.log(`✅ Created new ADMIN user: ${norm.original}`)
    console.log(`   User ID: ${newUser.id}`)
    console.log(`   Email verified: Yes`)
  }
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

