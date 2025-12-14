"use client"

import { useState, useEffect } from "react"
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Load Stripe with publishable key from environment
// IMPORTANT: Must use REAL Stripe test keys from https://dashboard.stripe.com/test/apikeys
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""

if (!publishableKey) {
  console.error("Stripe publishable key missing. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.")
}

const stripePromise = publishableKey ? loadStripe(publishableKey) : null

interface CustomerInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  billingAddress: string
  billingCity: string
  billingState: string
  billingZip: string
}

interface CheckoutFormProps {
  reservationId: string
  total: number
  rewardId?: string
  promoCode?: string
  onSuccess: (paymentIntentId?: string) => void
  onError: (error: string) => void
  onPaymentInfoEntered?: (info: CustomerInfo) => void
  hideContactInfo?: boolean
  initialCustomerInfo?: Partial<CustomerInfo>
}

interface PaymentFormProps {
  reservationId: string
  total: number
  clientSecret: string
  onSuccess: (paymentIntentId?: string) => void
  onError: (error: string) => void
  onPaymentInfoEntered?: (info: CustomerInfo) => void
  hideContactInfo?: boolean
  initialCustomerInfo?: Partial<CustomerInfo>
}

function PaymentForm({
  reservationId,
  total,
  clientSecret,
  onSuccess,
  onError,
  onPaymentInfoEntered,
  hideContactInfo,
  initialCustomerInfo,
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [stripeReady, setStripeReady] = useState(false)

  useEffect(() => {
    if (stripe && elements) {
      setStripeReady(true)
      console.log("Stripe and Elements are ready")
    } else {
      console.log("Stripe not ready:", { stripe: !!stripe, elements: !!elements })
    }
  }, [stripe, elements])
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    firstName: initialCustomerInfo?.firstName || "",
    lastName: initialCustomerInfo?.lastName || "",
    email: initialCustomerInfo?.email || "",
    phone: initialCustomerInfo?.phone || "",
    billingAddress: initialCustomerInfo?.billingAddress || "",
    billingCity: initialCustomerInfo?.billingCity || "",
    billingState: initialCustomerInfo?.billingState || "",
    billingZip: initialCustomerInfo?.billingZip || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    try {
      // Step 1: Submit the form to validate payment details
      // This must be called before confirmPayment()
      const { error: submitError } = await elements.submit()
      
      if (submitError) {
        onError(submitError.message || "Form validation failed")
        setIsProcessing(false)
        return
      }

      // Step 2: Confirm payment with Stripe using PaymentElement
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment(
        {
          elements,
          clientSecret,
          confirmParams: {
            payment_method_data: {
              billing_details: {
                name: `${customerInfo.firstName} ${customerInfo.lastName}`,
                email: customerInfo.email,
                phone: customerInfo.phone,
                address: {
                  line1: customerInfo.billingAddress,
                  city: customerInfo.billingCity,
                  state: customerInfo.billingState,
                  postal_code: customerInfo.billingZip,
                  country: "US",
                },
              },
            },
          },
          redirect: "if_required",
        }
      )

      if (confirmError) {
        onError(confirmError.message || "Payment failed")
        setIsProcessing(false)
        return
      }

      if (paymentIntent?.status === "succeeded") {
        // Webhook will convert reservation -> booking and send notifications
        onSuccess(paymentIntent.id)
      } else {
        onError("Payment did not complete. Please try again.")
      }
    } catch (error) {
      console.error("Payment error:", error)
      onError(error instanceof Error ? error.message : "Payment failed")
    } finally {
      setIsProcessing(false)
    }
  }


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!hideContactInfo && (
        <>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name *
                </label>
                <Input
                  required
                  value={customerInfo.firstName}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, firstName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name *
                </label>
                <Input
                  required
                  value={customerInfo.lastName}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <Input
                type="email"
                required
                value={customerInfo.email}
                onChange={(e) =>
                  setCustomerInfo({ ...customerInfo, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone *</label>
              <Input
                type="tel"
                required
                value={customerInfo.phone}
                onChange={(e) =>
                  setCustomerInfo({ ...customerInfo, phone: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Billing Address</h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                Street Address *
              </label>
              <Input
                required
                value={customerInfo.billingAddress}
                onChange={(e) =>
                  setCustomerInfo({ ...customerInfo, billingAddress: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">City *</label>
                <Input
                  required
                  value={customerInfo.billingCity}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, billingCity: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State *</label>
                <Input
                  required
                  maxLength={2}
                  value={customerInfo.billingState}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, billingState: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ZIP Code *</label>
                <Input
                  required
                  value={customerInfo.billingZip}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, billingZip: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Payment Information</h3>
        {!stripeReady ? (
          <div className="border rounded-lg p-4 bg-gray-50 text-center">
            <p className="text-gray-600">Loading payment form...</p>
          </div>
        ) : (
          <div className="border rounded-lg p-4 bg-white">
            <PaymentElement />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          <p className="text-sm text-gray-600">Total Amount</p>
          <p className="text-2xl font-bold">${total.toFixed(2)}</p>
        </div>
        {onPaymentInfoEntered ? (
          <Button
            type="button"
            onClick={() => {
              // Validate form first
              if (elements) {
                elements.submit().then((result) => {
                  if (!result.error && onPaymentInfoEntered) {
                    onPaymentInfoEntered(customerInfo)
                  }
                })
              }
            }}
            disabled={!stripe || !stripeReady}
            size="lg"
          >
            Continue to Confirmation
          </Button>
        ) : (
          <Button type="submit" disabled={isProcessing || !stripe} size="lg" data-checkout-form>
            {isProcessing ? "Processing..." : `Pay $${total.toFixed(2)}`}
          </Button>
        )}
      </div>
    </form>
  )
}

export function CheckoutForm({
  reservationId,
  total,
  rewardId,
  promoCode,
  onSuccess,
  onError,
  onPaymentInfoEntered,
  hideContactInfo,
  initialCustomerInfo,
}: CheckoutFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Create payment intent
    fetch("/api/payment/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId, rewardId, promoCode }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(errorData.error || `HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        console.log("Payment intent response:", data)
        if (data.error) {
          setError(data.error)
        } else if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setError("No client secret received from server")
        }
      })
      .catch((err) => {
        console.error("Error creating payment intent:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize payment")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [reservationId])

  if (!stripePromise) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-red-600 font-semibold">Payment is unavailable.</p>
        <p className="text-sm text-gray-600">
          Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Please contact support.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p>Loading payment form...</p>
      </div>
    )
  }

  if (error || !clientSecret) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-red-600 font-semibold">{error || "Failed to load payment form"}</p>
        {error && (
          <div className="text-sm text-gray-600">
            <p>Reservation ID: {reservationId}</p>
            <p>Total: ${total.toFixed(2)}</p>
            <p className="mt-2">Please check the browser console for more details.</p>
          </div>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setError(null)
            setLoading(true)
            setClientSecret(null)
            // Retry
            fetch("/api/payment/create-intent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reservationId, rewardId, promoCode }),
            })
              .then(async (res) => {
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
                  throw new Error(errorData.error || `HTTP ${res.status}`)
                }
                return res.json()
              })
              .then((data) => {
                if (data.error) {
                  setError(data.error)
                } else if (data.clientSecret) {
                  setClientSecret(data.clientSecret)
                } else {
                  setError("No client secret received from server")
                }
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to initialize payment")
              })
              .finally(() => {
                setLoading(false)
              })
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
    },
  }

  return (
    <Elements options={options} stripe={stripePromise}>
      <PaymentForm
        reservationId={reservationId}
        total={total}
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
        onPaymentInfoEntered={onPaymentInfoEntered}
        hideContactInfo={hideContactInfo}
        initialCustomerInfo={initialCustomerInfo}
      />
    </Elements>
  )
}

