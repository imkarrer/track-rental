"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function Header() {
  const { data: session, status } = useSession()

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600 flex items-center gap-2 hover:text-blue-700 transition-colors">
            <span className="text-3xl">🏁</span>
            RC Track Rental
          </Link>
          
          <nav className="flex items-center gap-4">
            <Link href="/" data-testid="nav-home-link" className="text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1">
              <span>🏠</span>
              <span>Home</span>
            </Link>
            <Link href="/tracks" data-testid="nav-tracks-link" className="text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1">
              <span>🏎️</span>
              <span>Tracks</span>
            </Link>
            
            {status === "loading" ? (
              <span data-testid="nav-loading" className="text-gray-500">⏳ Loading...</span>
            ) : session ? (
              <>
                <Link href="/bookings" data-testid="nav-bookings-link" className="text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1">
                  <span>📅</span>
                  <span>My Bookings</span>
                </Link>
                <Link href="/profile" data-testid="nav-profile-link" className="text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1">
                  <span>👤</span>
                  <span>Profile</span>
                </Link>
                {session.user.role === "ADMIN" && (
                  <Link href="/admin" data-testid="nav-admin-link" className="text-gray-700 hover:text-blue-600 font-semibold transition-colors flex items-center gap-1">
                    <span>⚙️</span>
                    <span>Admin</span>
                  </Link>
                )}
                {/* Debug: Uncomment to see role in header */}
                {/* <span className="text-xs text-gray-400">({session.user.role})</span> */}
                <Button
                  data-testid="nav-signout-button"
                  variant="outline"
                  size="sm"
                  onClick={() => signOut()}
                >
                  🚪 Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button data-testid="nav-login-button" variant="outline" size="sm">
                    🔐 Login
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button data-testid="nav-register-button" size="sm">
                    📝 Sign Up
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

