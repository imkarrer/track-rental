import Link from "next/link"
import { prisma } from "@/lib/db/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function AdminCarsPage() {
  const cars = await prisma.car.findMany({
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Manage Cars</h2>
        <Link href="/admin/cars/new">
          <Button>Add New Car</Button>
        </Link>
      </div>

      {cars.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 mb-4">No cars found</p>
            <Link href="/admin/cars/new">
              <Button>Create Your First Car</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.map((car) => (
            <Card key={car.id}>
              <CardHeader>
                <CardTitle>{car.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">Type: {car.type}</p>
                  <p className="text-sm text-gray-600">
                    Price: ${Number(car.basePricePerDay).toFixed(2)}/day
                  </p>
                  <p className="text-sm text-gray-600">
                    Stock: {car.stockQuantity}
                  </p>
                  <p className="text-sm">
                    Status:{" "}
                    <span
                      className={
                        car.isActive ? "text-green-600" : "text-red-600"
                      }
                    >
                      {car.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/cars/${car.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      Edit
                    </Button>
                  </Link>
                  <Link href={`/admin/cars/${car.id}/delete`} className="flex-1">
                    <Button variant="destructive" className="w-full">
                      Delete
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

