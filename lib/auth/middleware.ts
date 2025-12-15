import { getServerSession } from "next-auth"
import { authOptions } from "./config"
import { redirect } from "next/navigation"

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/auth/login")
  }
  
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  
  if (session.user.role !== "ADMIN") {
    redirect("/")
  }
  
  return session
}

