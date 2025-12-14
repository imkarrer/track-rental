"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [needsActivation, setNeedsActivation] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Signal when React has hydrated
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔐 [CLIENT] handleSubmit called - form submission started')
    console.log('   Email:', email)
    console.log('   Password length:', password.length)
    
    setError("")
    setNeedsActivation(false)
    setResendMessage("")
    setIsLoading(true)

    try {
      console.log('🔐 [CLIENT] Calling signIn...')
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })
      console.log('🔐 [CLIENT] signIn result:', result)

      if (result?.error) {
        console.log('❌ [CLIENT] signIn error:', result.error)
        // Check if it's an unverified email issue
        const checkResponse = await fetch("/api/auth/check-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
        
        if (checkResponse.ok) {
          const data = await checkResponse.json()
          if (!data.verified) {
            setNeedsActivation(true)
            setError("Your account is not activated. Please check your email for the activation link.")
          } else {
            setError("Invalid email or password")
          }
        } else {
          setError("Invalid email or password")
        }
      } else {
        console.log('✅ [CLIENT] signIn successful, redirecting to home')
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      console.error('❌ [CLIENT] signIn exception:', err)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendActivation = async () => {
    setResendLoading(true)
    setResendMessage("")
    
    try {
      const response = await fetch("/api/auth/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResendMessage(data.message || "Activation email sent!")
      } else {
        setResendMessage(data.error || "Failed to send email")
      }
    } catch (err) {
      setResendMessage("An error occurred. Please try again.")
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <span className="text-3xl">🔐</span>
            Login
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-hydrated={isHydrated}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
                {needsActivation && (
                  <div className="mt-3 pt-3 border-t border-red-300">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendActivation}
                      disabled={resendLoading}
                      className="w-full"
                    >
                      {resendLoading ? "⏳ Sending..." : "📧 Resend Activation Email"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {resendMessage && (
              <div className={`px-4 py-3 rounded flex items-center gap-2 ${
                resendMessage.includes("sent") || resendMessage.includes("Activation")
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-yellow-50 border border-yellow-200 text-yellow-700"
              }`}>
                <span>{resendMessage.includes("sent") ? "✓" : "ℹ️"}</span>
                <span>{resendMessage}</span>
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                📧 Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                🔑 Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "⏳ Signing in..." : "✓ Sign In"}
            </Button>
            
            <p className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/auth/register" className="text-blue-600 hover:underline">
                Sign up →
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

