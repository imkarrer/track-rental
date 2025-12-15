import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 1) {
    console.log("Usage: npx tsx scripts/check-user.ts <email>")
    console.log("Example: npx tsx scripts/check-user.ts admin@example.com")
    process.exit(1)
  }

  const email = args[0]

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    console.log(`❌ User with email "${email}" not found in database`)
    console.log("\nTo create this user, run:")
    console.log(`  npm run create-admin ${email} <password>`)
  } else {
    console.log(`✅ User found:`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.firstName} ${user.lastName}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Created: ${user.createdAt}`)
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

