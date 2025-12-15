import { prisma } from "@/lib/db/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookingManagement } from "@/components/admin/booking-management"
import { getRefundCalculation } from "@/lib/refunds/calculate"
import { formatDateUTC, toUTCDate } from "@/lib/date/format"
import { CommunicationPanel } from "@/components/admin/communication-panel"
import { serializeBookingForClient } from "@/lib/bookings/serialize"
import { BookingHistory } from "@/components/booking/booking-history"

// Mark as dynamic to prevent prerendering (requires auth and database)
export const dynamic = 'force-dynamic'

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: true,
      track: true,
      bookingCars: {
        include: {
          car: true,
        },
      },
      refunds: {
        orderBy: { processedAt: "desc" },
      },
    },
  })

  if (!booking) {
    notFound()
  }

  // Calculate refund information
  let refundCalculation = null
  try {
    refundCalculation = await getRefundCalculation(booking.id)
  } catch (error) {
    console.error("Error calculating refund:", error)
  }

  const serviceDate = toUTCDate(booking.eventDate)
  const now = Date.now()
  const daysUntilService = serviceDate
    ? Math.floor((serviceDate.getTime() - now) / (1000 * 60 * 60 * 24))
    : 0

  const bookingForClient = serializeBookingForClient({
    id: booking.id,
    total: booking.total,
    totalRefunded: booking.totalRefunded,
    status: booking.status,
    paymentIntentId: booking.paymentIntentId,
    eventDate: booking.eventDate,
  })

  const stripeStatus = (() => {
    if (!booking.paymentIntentId) {
      return { label: "No Stripe payment", variant: "outline" as const }
    }

    if (
      booking.cancellationReason &&
      booking.cancellationReason.toLowerCase().includes("dispute")
    ) {
      return { label: "Dispute", variant: "destructive" as const }
    }

    const refunded = Number(booking.totalRefunded || 0)
    const total = Number(booking.total || 0)
    if (refunded > 0) {
      const fully = refunded >= total - 0.01
      return {
        label: fully ? "Refunded (Stripe)" : "Partial refund",
        variant: fully ? ("destructive" as const) : ("secondary" as const),
      }
    }

    if (booking.status === "CANCELLED") {
      return { label: "Cancelled (Stripe)", variant: "destructive" as const }
    }

    if (booking.status === "CONFIRMED") {
      return { label: "Paid (Stripe)", variant: "default" as const }
    }

    return { label: "Pending Stripe", variant: "outline" as const }
  })()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">
          Booking #{booking.id.slice(0, 8)}
        </h2>
        <Badge
          variant={
            booking.status === "CONFIRMED"
              ? "default"
              : booking.status === "CANCELLED"
              ? "destructive"
              : booking.status === "COMPLETED"
              ? "secondary"
              : "outline"
          }
        >
          {booking.status}
        </Badge>
        <Badge variant={stripeStatus.variant} className="ml-2">
          {stripeStatus.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {booking.paymentIntentId && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-semibold">Payment Intent:</span>
                <span className="font-mono break-all">
                  {booking.paymentIntentId}
                </span>
              </div>
            )}
            <div>
              <span className="font-semibold">Track: </span>
              {booking.track.name}
            </div>
            <div>
              <span className="font-semibold">Event Date: </span>
              {formatDateUTC(booking.eventDate)}
              {booking.endDate && (
                <span> - {formatDateUTC(booking.endDate)}</span>
              )}
            </div>
            <div>
              <span className="font-semibold">Time: </span>
              {booking.startTime} - {booking.endTime}
            </div>
            <div>
              <span className="font-semibold">Duration: </span>
              {booking.durationHours} hours
            </div>
            <div>
              <span className="font-semibold">Location: </span>
              {booking.eventAddress}, {booking.eventCity}, {booking.eventState}{" "}
              {booking.eventZip}
            </div>
            {booking.distanceFromBase && (
              <div>
                <span className="font-semibold">Distance: </span>
                {Number(booking.distanceFromBase).toFixed(1)} miles
              </div>
            )}
            <div>
              <span className="font-semibold">Days Until Service: </span>
              <span className={daysUntilService < 0 ? "text-red-600" : ""}>
                {daysUntilService < 0
                  ? `Past (${Math.abs(daysUntilService)} days ago)`
                  : `${daysUntilService} days`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="font-semibold">Name: </span>
              {booking.user.firstName} {booking.user.lastName}
            </div>
            <div>
              <span className="font-semibold">Email: </span>
              {booking.user.email}
            </div>
            {booking.user.phone && (
              <div>
                <span className="font-semibold">Phone: </span>
                {booking.user.phone}
              </div>
            )}
            <div>
              <span className="font-semibold">Booking Created: </span>
              {formatDateUTC(booking.createdAt)} {new Date(booking.createdAt).toLocaleTimeString()}
            </div>
            {booking.cancelledAt && (
              <div>
                <span className="font-semibold">Cancelled: </span>
                {formatDateUTC(booking.cancelledAt)} {new Date(booking.cancelledAt).toLocaleTimeString()}
              </div>
            )}
            {booking.cancellationReason && (
              <div>
                <span className="font-semibold">Cancellation Reason: </span>
                <p className="text-sm text-gray-600 mt-1">
                  {booking.cancellationReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Track Base Price:</span>
              <span>${Number(booking.basePrice || 0).toFixed(2)}</span>
            </div>
            {booking.dayMultiplier && Number(booking.dayMultiplier) !== 1 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Day Multiplier ({Number(booking.dayMultiplier).toFixed(2)}x):</span>
                <span>
                  ${(
                    Number(booking.basePrice || 0) * Number(booking.dayMultiplier) -
                    Number(booking.basePrice || 0)
                  ).toFixed(2)}
                </span>
              </div>
            )}
            {booking.durationMultiplier && Number(booking.durationMultiplier) !== 1 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Duration Multiplier ({Number(booking.durationMultiplier).toFixed(2)}x):</span>
                <span>Applied</span>
              </div>
            )}
            {Number(booking.additionalCarsPrice) > 0 && (
              <div className="flex justify-between">
                <span>Additional Cars ({booking.additionalCarsCount}):</span>
                <span>${Number(booking.additionalCarsPrice).toFixed(2)}</span>
              </div>
            )}
            {Number(booking.distanceSurcharge) > 0 && (
              <div className="flex justify-between">
                <span>Distance Surcharge:</span>
                <span>${Number(booking.distanceSurcharge).toFixed(2)}</span>
              </div>
            )}
            {Number(booking.setupFee) > 0 && (
              <div className="flex justify-between">
                <span>Setup Fee:</span>
                <span>${Number(booking.setupFee).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="font-semibold">Subtotal:</span>
              <span className="font-semibold">
                ${Number(booking.subtotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8%):</span>
              <span>${Number(booking.tax).toFixed(2)}</span>
            </div>
            {booking.referralCode && Number(booking.referralDiscount) > 0 && (
              <>
                <div className="flex justify-between pt-2 border-t">
                  <span>Subtotal + Tax:</span>
                  <span className="line-through text-gray-500">
                    ${(Number(booking.subtotal) + Number(booking.tax)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <span>🎉</span>
                    Promo Code ({booking.referralCode}):
                  </span>
                  <span className="font-semibold">-${Number(booking.referralDiscount).toFixed(2)}</span>
                </div>
              </>
            )}
            {booking.rewardId && Number(booking.rewardDiscount) > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Reward Applied:</span>
                <span className="font-semibold">-${Number(booking.rewardDiscount).toFixed(2)}</span>
              </div>
            )}
            <div className={`flex justify-between border-t pt-2 mt-2 font-bold text-lg ${
              (booking.referralCode && Number(booking.referralDiscount) > 0) ? 'text-green-700' : ''
            }`}>
              <span>Total Charged:</span>
              <span>${Number(booking.total).toFixed(2)}</span>
            </div>
            {Number(booking.totalRefunded) > 0 && (
              <div className="flex justify-between text-red-600 border-t pt-2 mt-2">
                <span>Total Refunded:</span>
                <span>-${Number(booking.totalRefunded).toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cars */}
        <Card>
          <CardHeader>
            <CardTitle>Cars Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {booking.bookingCars.map((bookingCar) => (
                <div
                  key={bookingCar.id}
                  className="flex justify-between items-center"
                >
                  <span>
                    {bookingCar.car.name} (x{bookingCar.quantity})
                    {bookingCar.isFree && (
                      <Badge variant="secondary" className="ml-2">
                        Included
                      </Badge>
                    )}
                  </span>
                  {!bookingCar.isFree && (
                    <span>${Number(bookingCar.totalPrice).toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Promo Code / Discounts */}
        {(booking.referralCode || booking.rewardId) && (
          <Card>
            <CardHeader>
              <CardTitle>Discounts Applied</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {booking.referralCode && (
                <div className="border rounded-lg p-3 bg-green-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-green-800 flex items-center gap-1">
                      <span>🎉</span>
                      Promo Code
                    </span>
                    <Badge variant="outline" className="bg-white">
                      {booking.referralCode}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discount Amount:</span>
                      <span className="font-medium text-green-700">
                        ${Number(booking.referralDiscount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {booking.rewardId && (
                <div className="border rounded-lg p-3 bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-blue-800">
                      Reward Credit
                    </span>
                    <Badge variant="outline" className="bg-white">
                      {booking.rewardId.slice(0, 8)}...
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discount Amount:</span>
                      <span className="font-medium text-blue-700">
                        ${Number(booking.rewardDiscount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Refund Management */}
      {refundCalculation && (
        <BookingManagement
          booking={bookingForClient}
          refundCalculation={refundCalculation}
        />
      )}

      {/* Refund History */}
      {booking.refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Refund History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {booking.refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">
                        ${Number(refund.amount).toFixed(2)} - {refund.refundType}
                      </div>
                      <div className="text-sm text-gray-500">
                        Processed: {new Date(refund.processedAt).toLocaleString()}
                      </div>
                    </div>
                    {refund.stripeRefundId && (
                      <Badge variant="outline" className="text-xs">
                        Stripe: {refund.stripeRefundId.slice(0, 20)}...
                      </Badge>
                    )}
                  </div>
                  {refund.reason && (
                    <div>
                      <span className="font-semibold text-sm">Reason: </span>
                      <span className="text-sm">{refund.reason}</span>
                    </div>
                  )}
                  {refund.circumstances && (
                    <div>
                      <span className="font-semibold text-sm">
                        Circumstances:{" "}
                      </span>
                      <span className="text-sm">{refund.circumstances}</span>
                    </div>
                  )}
                  {refund.notes && (
                    <div>
                      <span className="font-semibold text-sm">Notes: </span>
                      <span className="text-sm">{refund.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Booking History - Complete Audit Trail */}
      <BookingHistory bookingId={booking.id} />

      <CommunicationPanel
        bookingId={booking.id}
        defaultEmail={booking.user.email}
        defaultPhone={booking.phone || ""}
      />
    </div>
  )
}

