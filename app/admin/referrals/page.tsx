import { prisma } from "@/lib/db/prisma"
import { ReferralsTable } from "@/components/admin/referrals-table"
import { ReferralProgramConfigCard } from "@/components/admin/referral-program-config"
import { AdminPromoCodesManager } from "@/components/admin/admin-promo-codes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Mark as dynamic to prevent prerendering (requires auth and database)
export const dynamic = 'force-dynamic'

export default async function AdminReferralsPage() {
  let userCodes: any[] = []
  try {
    if (typeof (prisma as any).referralCode?.findMany === "function") {
      // Only fetch USER type codes for the user referrals section
      userCodes = await prisma.referralCode.findMany({
        where: {
          type: "USER",
        },
        include: {
          owner: {
            select: { email: true, firstName: true, lastName: true },
          },
          redemptions: {
            include: {
              user: {
                select: { email: true, firstName: true, lastName: true, createdAt: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    }
  } catch (err) {
    console.error("Failed to load referral codes:", err)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral & Promotional Codes</h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage promotional campaigns and user referral programs
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">ℹ️</span>
            Two Types of Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-3">
          <div>
            <p className="font-semibold text-blue-700 mb-1">🎟️ Admin Promotional Codes</p>
            <p>
              Create custom codes for advertising campaigns, special offers, and marketing initiatives.
              Examples: &quot;SUMMER2025&quot;, &quot;LAUNCH50&quot;, &quot;FREESHIP&quot;. These are managed by admins and can be 
              named, edited, and deactivated.
            </p>
          </div>
          <div>
            <p className="font-semibold text-green-700 mb-1">👥 User Referral Codes</p>
            <p>
              Each user automatically gets their own referral code to share with friends and family.
              When someone uses their code, both the referrer and the new user can receive incentives.
              These codes are auto-generated and tied to user accounts.
            </p>
          </div>
          <div>
            <p className="font-semibold text-purple-700 mb-1">💰 Referral Incentive</p>
            <p>
              Configure the reward that applies to ALL referral codes (both promotional and user referrals).
              Set a percentage or flat dollar amount discount.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Referral Incentive Configuration */}
      <ReferralProgramConfigCard />

      {typeof (prisma as any).referralCode?.findMany !== "function" ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>⚠️ Database Migration Required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700 space-y-2">
            <p>
              The Prisma client does not include referral code tables. Run your database
              migration after pulling the latest schema:
            </p>
            <div className="bg-white rounded p-3 font-mono text-xs space-y-1">
              <div>$ npm run db:generate</div>
              <div>$ npm run db:push</div>
            </div>
            <p className="text-xs">
              Or run the migration file: <code>MIGRATION_referral_codes_enhancement.sql</code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Admin Promotional Codes */}
          <AdminPromoCodesManager />

          {/* User Referral Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">👥</span>
                User Referral Codes
              </CardTitle>
              <p className="text-sm text-gray-600">
                View and manage referral codes that belong to registered users. Users can share their 
                codes with friends to earn rewards. These codes are automatically generated when users 
                sign up and cannot be edited by admins.
              </p>
            </CardHeader>
            <CardContent>
              <ReferralsTable initialCodes={userCodes as any} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}


