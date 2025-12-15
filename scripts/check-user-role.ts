import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 1) {
    console.log("Usage: npx tsx scripts/check-user-role.ts <email>")
    console.log("Example: npx tsx scripts/check-user-role.ts admin@example.com")
    process.exit(1)
  }

  const email = args[0]

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  })

  if (!user) {
    console.log(`❌ User with email "${email}" not found`)
    process.exit(1)
  }

  console.log("\n📋 User Information:")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`ID:       ${user.id}`)
  console.log(`Email:    ${user.email}`)
  console.log(`Name:     ${user.firstName} ${user.lastName}`)
  console.log(`Role:     ${user.role}`)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  if (user.role === "ADMIN") {
    console.log("\n✅ User is an ADMIN")
    console.log("\n💡 If you don't see the Admin link in the header:")
    console.log("   1. Log out and log back in")
    console.log("   2. Clear your browser cookies")
    console.log("   3. Hard refresh the page (Ctrl+Shift+R)")
  } else {
    console.log("\n⚠️  User is NOT an admin")
    console.log(`\nTo make this user an admin, run:`)
    console.log(`npm run create-admin ${email} <password>`)
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

