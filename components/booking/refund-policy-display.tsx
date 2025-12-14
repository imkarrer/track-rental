"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface RefundPolicy {
  id: string
  daysBeforeService: number
  nonRefundablePercent: number
  description: string | null
}

interface RefundPolicyDisplayProps {
  policies: RefundPolicy[]
  compact?: boolean
}

export function RefundPolicyDisplay({
  policies,
  compact = false,
}: RefundPolicyDisplayProps) {
  if (policies.length === 0) {
    return null
  }

  // Sort by daysBeforeService descending
  const sortedPolicies = [...policies].sort(
    (a, b) => b.daysBeforeService - a.daysBeforeService
  )

  if (compact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Refund Policy</CardTitle>
          <CardDescription>
            Refund percentage decreases as the service date approaches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {sortedPolicies.map((policy) => {
              const refundPercent = 100 - policy.nonRefundablePercent
              return (
                <div key={policy.id} className="flex justify-between">
                  <span>
                    {policy.daysBeforeService}+ days before:
                  </span>
                  <span className="font-semibold text-green-600">
                    {refundPercent}% refund
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund Policy</CardTitle>
        <CardDescription>
          Please review our refund policy before completing your booking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700">
          The refund percentage depends on how far in advance you cancel. 
          The closer to the service date, the lower the refund percentage.
        </p>

        <div className="space-y-3">
          {sortedPolicies.map((policy) => {
            const refundPercent = 100 - policy.nonRefundablePercent
            return (
              <div
                key={policy.id}
                className="border rounded-lg p-3 bg-gray-50"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold">
                    {policy.daysBeforeService}+ Days Before Service
                  </span>
                  <span className="font-semibold text-green-600">
                    {refundPercent}% Refund
                  </span>
                </div>
                {policy.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {policy.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="pt-3 border-t">
          <p className="text-xs text-gray-500 mb-2">
            • Policies are matched based on cancellation date relative to service date
          </p>
          <p className="text-xs text-gray-500 mb-2">
            • Cancellations after the service date receive no refund
          </p>
          <Link
            href="/refund-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View complete refund policy (opens in new tab) →
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

