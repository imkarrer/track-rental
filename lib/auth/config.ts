import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/db/prisma"
import bcrypt from "bcryptjs"
import { normalizeEmail } from "@/lib/auth/email-normalize"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('🔐 [AUTH] authorize() called with email:', credentials?.email)
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ [AUTH] Missing credentials')
          return null
        }

        const norm = normalizeEmail(credentials.email)
        console.log('🔍 [AUTH] Looking for user with canonical email:', norm.canonical)
        
        const user = await prisma.user.findUnique({
          where: { emailCanonical: norm.canonical }
        })

        if (!user) {
          console.log('❌ [AUTH] User not found')
          return null
        }
        
        console.log('✅ [AUTH] User found:', user.id, 'verified:', !!user.emailVerified)

        if (!user.emailVerified) {
          console.log('❌ [AUTH] Email not verified')
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          console.log('❌ [AUTH] Invalid password')
          return null
        }

        console.log('✅ [AUTH] Authentication successful, returning user object')
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      console.log('🎫 [AUTH] jwt() callback - user present:', !!user)
      if (user) {
        token.role = user.role
        token.id = user.id
        console.log('✅ [AUTH] JWT token created for user:', user.id)
      }
      return token
    },
    async session({ session, token }) {
      console.log('📋 [AUTH] session() callback - token:', !!token)
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        console.log('✅ [AUTH] Session created for user:', token.id)
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Cookie configuration - explicitly allow insecure cookies for local development and E2E tests
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Allow insecure cookies for localhost (http://)
        secure: false,
      },
    },
  },
}

