import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  migrate: {
    async url() {
      return process.env.DATABASE_URL!
    },
  },
})
