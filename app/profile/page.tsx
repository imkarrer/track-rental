import { requireAuth } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MyReferral } from "@/components/profile/my-referral"

export default async function ProfilePage() {
  const session = await requireAuth()
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      addresses: true,
    },
  })

  if (!user) {
    return <div>User not found</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <span className="text-4xl">👤</span>
        Profile
      </h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">📝</span>
              Personal Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">👤 Name</label>
              <p className="text-lg">{user.firstName} {user.lastName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">📧 Email</label>
              <p className="text-lg">{user.email}</p>
            </div>
            {user.phone && (
              <div>
                <label className="text-sm font-medium text-gray-500">📱 Phone</label>
                <p className="text-lg">{user.phone}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">🎭 Role</label>
              <p className="text-lg capitalize">{user.role.toLowerCase()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              Addresses
            </CardTitle>
            <CardDescription>Your saved addresses</CardDescription>
          </CardHeader>
          <CardContent>
            {user.addresses.length === 0 ? (
              <p className="text-gray-500">No addresses saved</p>
            ) : (
              <div className="space-y-4">
                {user.addresses.map((address) => (
                  <div key={address.id} className="border-b pb-4 last:border-0">
                    <p className="font-medium">🏠 {address.streetAddress}</p>
                    <p className="text-gray-600">
                      {address.city}, {address.state} {address.zipCode}
                    </p>
                    {address.isBilling && (
                      <span className="text-xs text-blue-600 font-medium">💳 Billing Address</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <MyReferral />
      </div>
    </div>
  )
}

