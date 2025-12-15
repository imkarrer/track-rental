"use client"

import { useEffect, useState, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function ActivatePageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  const activateAccount = useCallback(async (tokenValue: string) => {
    try {
      const response = await fetch("/api/auth/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: tokenValue }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus("success")
        setMessage("Your account has been activated successfully!")
      } else {
        setStatus("error")
        setMessage(data.error || "Activation failed")
      }
    } catch {
      setStatus("error")
      setMessage("An error occurred during activation")
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("No activation token provided")
      return
    }

    activateAccount(token)
  }, [token, activateAccount])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            {status === "loading" && (
              <>
                <span className="text-3xl">⏳</span>
                Activating Account
              </>
            )}
            {status === "success" && (
              <>
                <span className="text-3xl">✅</span>
                Account Activated!
              </>
            )}
            {status === "error" && (
              <>
                <span className="text-3xl">❌</span>
                Activation Failed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we activate your account..."}
            {status === "success" && "You can now sign in to your account"}
            {status === "error" && "There was a problem activating your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2">
                <span>✓</span>
                <span>{message}</span>
              </div>
              <Link href="/auth/login">
                <Button className="w-full">
                  🔐 Sign In
                </Button>
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
                <span>⚠️</span>
                <span>{message}</span>
              </div>
              <div className="text-sm text-gray-600">
                <p className="mb-2">This could mean:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>The activation link has expired (30 minutes)</li>
                  <li>The account has already been activated</li>
                  <li>The activation link is invalid</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Link href="/auth/register">
                  <Button variant="outline" className="w-full">
                    Create New Account
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    Try Sign In
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <ActivatePageContent />
    </Suspense>
  )
}

