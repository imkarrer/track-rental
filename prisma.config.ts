import { defineConfig } from 'prisma/config'

export default defineConfig({
  migrate: {
    async url() {
      return process.env.DATABASE_URL!
    },
  },
})
