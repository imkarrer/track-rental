import { prisma } from "@/lib/db/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RefundPolicy } from "@prisma/client"

// Mark this page as dynamic to prevent prerendering during build
export const dynamic = 'force-dynamic'

export default async function RefundPolicyPage() {
  // Handle case where database might not be available during build
  let policies: RefundPolicy[] = []
  try {
    policies = await prisma.refundPolicy.findMany({
      where: { isActive: true },
      orderBy: { daysBeforeService: "desc" },
    })
  } catch (error) {
    // During build time or if database is unavailable, show empty state
    // This allows the build to succeed
    console.warn("Could not fetch refund policies:", error instanceof Error ? error.message : String(error))
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-6">Refund Policy</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            Our refund policy is designed to be fair and transparent. The refund
            percentage you receive depends on how far in advance you cancel your
            booking. The earlier you cancel, the higher your refund percentage.
          </p>
          <p className="text-gray-700">
            All refunds are processed through the same payment method used for the
            original booking. Refunds typically take 5-10 business days to appear
            in your account.
          </p>
        </CardContent>
      </Card>

      {policies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No refund policies are currently configured.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Cancellation Terms</h2>
          {policies.map((policy) => {
            const refundPercent = 100 - Number(policy.nonRefundablePercent)
            return (
              <Card key={policy.id}>
                <CardHeader>
                  <CardTitle>
                    {policy.daysBeforeService}+ Days Before Service
                  </CardTitle>
                  <CardDescription className="text-green-600 font-medium">
                    {refundPercent}% Refund
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {policy.description && (
                    <p className="text-gray-700 mb-3">{policy.description}</p>
                  )}
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Example:</strong> If you cancel a $500 booking{" "}
                      {policy.daysBeforeService} or more days before the service date,
                      you will receive a <strong className="text-green-700">${(500 - (500 * Number(policy.nonRefundablePercent)) / 100).toFixed(2)} refund</strong>{" "}
                      ({refundPercent}% of your booking).
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            • Refund policies are applied based on the cancellation date relative to
            the service date
          </p>
          <p>
            • The system automatically calculates the applicable policy based on
            how many days before service you cancel
          </p>
          <p>
            • If you cancel after the service date has passed, no refund is available
          </p>
          <p>
            • Partial refunds may be available at our discretion for special
            circumstances (weather, emergencies, etc.)
          </p>
          <p>
            • To request a refund, please contact customer service or use the
            booking management system if you have an account
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Questions?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            If you have questions about our refund policy or need to request a
            refund, please contact our customer service team. We&apos;re here to help!
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

