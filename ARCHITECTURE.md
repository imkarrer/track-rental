# Architecture & Flow Diagrams

This document contains sequence diagrams for the main user and admin operations in the RC Track Rental application.

## Table of Contents

- [User Operations](#user-operations)
  - [User Registration](#user-registration)
  - [Booking a Track](#booking-a-track)
  - [Modifying a Booking](#modifying-a-booking)
  - [Cancelling a Booking](#cancelling-a-booking)
- [Admin Operations](#admin-operations)
  - [Admin Booking Management](#admin-booking-management)
  - [Processing a Refund](#processing-a-refund)
  - [Managing Tracks & Cars](#managing-tracks--cars)

---

## User Operations

### User Registration

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Routes
    participant DB as Database
    participant Email as Email Service

    U->>FE: Fill registration form
    FE->>API: POST /api/auth/register
    API->>API: Validate input (Zod)
    API->>API: Normalize email
    API->>DB: Check if user exists
    alt User exists
        DB-->>API: User found
        API-->>FE: 400 Email already registered
        FE-->>U: Show error message
    else User doesn't exist
        DB-->>API: No user found
        API->>API: Hash password (bcrypt)
        API->>API: Generate activation token
        API->>DB: Create user (unverified)
        DB-->>API: User created
        API->>Email: Send activation email
        Email-->>API: Email sent
        API-->>FE: 201 Success
        FE-->>U: Show "Check your email"
    end

    U->>FE: Click activation link
    FE->>API: GET /api/auth/activate?token=xxx
    API->>DB: Find user by token
    alt Valid token
        DB-->>API: User found
        API->>DB: Set emailVerified, clear token
        API-->>FE: Redirect to login
        FE-->>U: Show login page
    else Invalid/expired token
        API-->>FE: 400 Invalid token
        FE-->>U: Show error
    end
```

### Booking a Track

This is the main user journey - from selecting a track to completing payment.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Routes
    participant DB as Database
    participant Stripe as Stripe API

    Note over U,Stripe: Step 1: Browse & Select Track
    U->>FE: Browse /shop/tracks
    FE->>API: GET /api/tracks
    API->>DB: Fetch active tracks
    DB-->>API: Tracks list
    API-->>FE: Return tracks
    FE-->>U: Display tracks

    U->>FE: Select track, choose date
    FE->>API: GET /api/tracks/{id}/availability
    API->>DB: Get bookings & reservations
    DB-->>API: Existing bookings
    API->>API: Calculate unavailable dates
    API-->>FE: Available dates
    FE-->>U: Show calendar with availability

    Note over U,Stripe: Step 2: Enter Event Details
    U->>FE: Enter address, time, cars
    FE->>API: POST /api/distance
    API->>API: Calculate distance from base
    API-->>FE: Distance & surcharge

    FE->>API: POST /api/pricing
    API->>DB: Get pricing config, multipliers
    DB-->>API: Pricing rules
    API->>API: Calculate total price
    API-->>FE: Price breakdown
    FE-->>U: Show price summary

    Note over U,Stripe: Step 3: Create Reservation (10-min hold)
    U->>FE: Click "Proceed to Payment"
    FE->>API: POST /api/reservations
    API->>DB: Check date still available
    alt Date taken
        API-->>FE: 409 Conflict
        FE-->>U: "Date no longer available"
    else Date available
        API->>DB: Delete expired reservations
        API->>DB: Create reservation (10-min expiry)
        DB-->>API: Reservation created
        API-->>FE: Reservation ID
    end

    Note over U,Stripe: Step 4: Payment
    FE->>API: POST /api/payment
    API->>Stripe: Create PaymentIntent
    Stripe-->>API: Client secret
    API-->>FE: Client secret

    FE->>Stripe: Collect card details
    U->>FE: Enter card, submit payment
    FE->>Stripe: Confirm payment
    Stripe-->>FE: Payment result

    alt Payment successful
        Stripe->>API: Webhook: payment_intent.succeeded
        API->>DB: Find reservation
        API->>DB: Convert reservation to booking
        API->>DB: Delete reservation
        DB-->>API: Booking created
        API->>API: Send confirmation email
        API-->>Stripe: 200 OK
        FE-->>U: Redirect to /bookings/success
    else Payment failed
        Stripe-->>FE: Error
        FE-->>U: Show payment error
    end
```

### Modifying a Booking

Users can modify their booking date, time, or car selection.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Routes
    participant DB as Database
    participant Stripe as Stripe API

    U->>FE: Go to /bookings
    FE->>API: GET /api/bookings
    API->>DB: Get user's bookings
    DB-->>API: Bookings list
    API-->>FE: Return bookings
    FE-->>U: Display bookings

    U->>FE: Click "Modify" on booking
    FE->>API: GET /api/bookings/{id}
    API->>DB: Get booking details
    DB-->>API: Booking data
    API-->>FE: Booking details
    FE-->>U: Show modification form

    U->>FE: Change date/time/cars
    FE->>API: POST /api/bookings/{id}/modify/preview
    API->>DB: Get current booking
    API->>DB: Check new date availability
    API->>API: Calculate new price
    API->>API: Calculate price difference
    API-->>FE: Preview with price diff
    FE-->>U: Show price change summary

    alt Price increased
        U->>FE: Confirm & pay difference
        FE->>API: POST /api/bookings/{id}/modify
        API->>Stripe: Create PaymentIntent for difference
        Stripe-->>API: Client secret
        API-->>FE: Requires payment
        FE->>Stripe: Process payment
        Stripe->>API: Webhook: payment succeeded
        API->>DB: Update booking
        API->>DB: Record in BookingHistory
        API-->>FE: Success
    else Price decreased
        U->>FE: Confirm modification
        FE->>API: POST /api/bookings/{id}/modify
        API->>Stripe: Create refund for difference
        Stripe-->>API: Refund processed
        API->>DB: Update booking
        API->>DB: Record refund & history
        API-->>FE: Success
    else Same price
        U->>FE: Confirm modification
        FE->>API: POST /api/bookings/{id}/modify
        API->>DB: Update booking
        API->>DB: Record in BookingHistory
        API-->>FE: Success
    end

    FE-->>U: Show updated booking
```

### Cancelling a Booking

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Routes
    participant DB as Database
    participant Stripe as Stripe API

    U->>FE: Click "Cancel" on booking
    FE->>API: GET /api/bookings/{id}/cancel/preview
    API->>DB: Get booking details
    API->>DB: Get refund policies
    DB-->>API: Policies
    API->>API: Calculate days until event
    API->>API: Determine refund percentage
    API-->>FE: Refund preview
    FE-->>U: Show refund amount & policy

    U->>FE: Confirm cancellation
    FE->>API: POST /api/bookings/{id}/cancel
    API->>DB: Get booking & verify ownership
    API->>API: Calculate refund amount
    
    alt Refund amount > 0
        API->>Stripe: Create refund
        Stripe-->>API: Refund processed
        API->>DB: Update booking status = CANCELLED
        API->>DB: Record refund in Refunds table
        API->>DB: Record in BookingHistory
        API->>API: Send cancellation email
        API-->>FE: Booking cancelled, refund issued
    else No refund (< 3 days)
        API->>DB: Update booking status = CANCELLED
        API->>DB: Record in BookingHistory
        API->>API: Send cancellation email
        API-->>FE: Booking cancelled, no refund
    end

    FE-->>U: Show confirmation
```

---

## Admin Operations

### Admin Booking Management

```mermaid
sequenceDiagram
    participant A as Admin
    participant FE as Admin Dashboard
    participant API as API Routes
    participant DB as Database

    A->>FE: Go to /admin/bookings
    FE->>API: GET /api/admin/bookings
    API->>API: Verify admin role
    API->>DB: Fetch all bookings with relations
    DB-->>API: Bookings with users, tracks
    API-->>FE: Return bookings
    FE-->>A: Display bookings table

    A->>FE: Filter by status/date
    FE->>API: GET /api/admin/bookings?status=CONFIRMED
    API->>DB: Filtered query
    DB-->>API: Filtered results
    API-->>FE: Filtered bookings
    FE-->>A: Update table

    A->>FE: Click booking for details
    FE->>API: GET /api/admin/bookings/{id}
    API->>DB: Get booking with all relations
    API->>DB: Get booking history
    API->>DB: Get communication logs
    DB-->>API: Full booking data
    API-->>FE: Booking details
    FE-->>A: Show detail view with history
```

### Processing a Refund

Admins can issue full or partial refunds with custom amounts.

```mermaid
sequenceDiagram
    participant A as Admin
    participant FE as Admin Dashboard
    participant API as API Routes
    participant DB as Database
    participant Stripe as Stripe API

    A->>FE: Open booking details
    A->>FE: Click "Issue Refund"
    FE-->>A: Show refund dialog

    A->>FE: Select refund type & amount
    Note right of A: Full, Partial, or Admin Discretion

    A->>FE: Enter reason & notes
    A->>FE: Submit refund

    FE->>API: POST /api/admin/bookings/{id}/refund
    API->>API: Verify admin role
    API->>DB: Get booking & payment details
    DB-->>API: Booking with paymentIntentId

    API->>API: Validate refund amount
    Note right of API: Cannot exceed total - already refunded

    API->>Stripe: POST /refunds
    Stripe-->>API: Refund created

    API->>DB: Update booking.totalRefunded
    API->>DB: Create Refund record
    API->>DB: Create BookingHistory entry
    
    alt Full refund
        API->>DB: Set status = CANCELLED
    end

    API->>API: Send refund notification email
    API-->>FE: Refund processed
    FE-->>A: Show success, update view
```

### Managing Tracks & Cars

```mermaid
sequenceDiagram
    participant A as Admin
    participant FE as Admin Dashboard
    participant API as API Routes
    participant DB as Database
    participant S3 as MinIO/S3

    Note over A,S3: Creating a New Track
    A->>FE: Go to /admin/tracks/new
    FE-->>A: Show track form

    A->>FE: Fill track details
    A->>FE: Upload images
    FE->>API: POST /api/upload
    API->>S3: Upload image
    S3-->>API: Image URL
    API-->>FE: Image URL
    FE-->>A: Show image preview

    A->>FE: Select included cars
    A->>FE: Submit form
    FE->>API: POST /api/admin/tracks
    API->>API: Verify admin role
    API->>API: Validate track data
    API->>DB: Create track
    DB-->>API: Track created
    API-->>FE: Success
    FE-->>A: Redirect to track list

    Note over A,S3: Editing Existing Track
    A->>FE: Click edit on track
    FE->>API: GET /api/admin/tracks/{id}
    API->>DB: Get track
    DB-->>API: Track data
    API-->>FE: Track details
    FE-->>A: Show edit form

    A->>FE: Modify fields
    A->>FE: Save changes
    FE->>API: PUT /api/admin/tracks/{id}
    API->>API: Verify admin role
    API->>DB: Update track
    DB-->>API: Updated
    API-->>FE: Success
    FE-->>A: Show updated track

    Note over A,S3: Deactivating a Track
    A->>FE: Toggle "Active" switch
    FE->>API: PATCH /api/admin/tracks/{id}
    API->>DB: Set isActive = false
    DB-->>API: Updated
    API-->>FE: Success
    FE-->>A: Track now hidden from users
```

---

## Payment Flow Details

### Stripe Webhook Processing

```mermaid
sequenceDiagram
    participant Stripe as Stripe
    participant API as Webhook Handler
    participant DB as Database
    participant Email as Email Service

    Stripe->>API: POST /api/webhooks/stripe
    API->>API: Verify webhook signature
    
    alt Invalid signature
        API-->>Stripe: 400 Bad Request
    else Valid signature
        API->>API: Parse event type
        
        alt payment_intent.succeeded
            API->>DB: Find reservation by paymentIntentId
            alt Reservation found
                API->>DB: Create booking from reservation
                API->>DB: Create BookingCar records
                API->>DB: Delete reservation
                API->>DB: Create BookingHistory (CREATED)
                API->>Email: Send confirmation email
                API-->>Stripe: 200 OK
            else No reservation (already converted)
                API-->>Stripe: 200 OK (idempotent)
            end
            
        else payment_intent.payment_failed
            API->>DB: Find reservation
            API->>DB: Delete reservation (free up slot)
            API-->>Stripe: 200 OK
            
        else charge.refunded
            API->>DB: Find booking by charge ID
            API->>DB: Update totalRefunded
            API-->>Stripe: 200 OK
        end
    end
```

---

## Cron Job Flows

### Reservation Cleanup

```mermaid
sequenceDiagram
    participant Cron as Cron Job
    participant API as API Route
    participant DB as Database

    Cron->>API: GET /api/cron/cleanup
    API->>API: Verify cron secret
    API->>DB: Find expired reservations
    Note right of DB: WHERE expiresAt < NOW()
    DB-->>API: Expired reservations
    
    loop Each expired reservation
        API->>DB: Delete reservation
    end
    
    API-->>Cron: {deleted: count}
```

### Booking Reminders

```mermaid
sequenceDiagram
    participant Cron as Cron Job
    participant API as API Route
    participant DB as Database
    participant Email as Email Service
    participant SMS as SMS Service

    Cron->>API: GET /api/cron/reminders
    API->>API: Verify cron secret
    API->>DB: Get reminder config (offsets)
    DB-->>API: [7, 3, 1] days before
    
    loop Each offset
        API->>DB: Find bookings with eventDate = NOW + offset
        DB-->>API: Bookings needing reminder
        
        loop Each booking
            alt Email not opted out
                API->>Email: Send reminder email
            end
            alt SMS opted in
                API->>SMS: Send reminder SMS
            end
            API->>DB: Log communication
        end
    end
    
    API-->>Cron: {sent: count}
```

---

## Data Models

### Key Relationships

```mermaid
erDiagram
    User ||--o{ Booking : "has"
    User ||--o{ Reservation : "has"
    User ||--o{ Address : "has"
    User ||--o{ ReferralCode : "owns"
    
    Track ||--o{ Booking : "booked for"
    Track ||--o{ Reservation : "reserved"
    
    Car ||--o{ BookingCar : "rented in"
    Booking ||--o{ BookingCar : "includes"
    Booking ||--o{ Refund : "has"
    Booking ||--o{ BookingHistory : "has"
    Booking ||--o{ CommunicationLog : "has"
    
    ReferralCode ||--o{ ReferralRedemption : "redeemed via"
    ReferralCode ||--o{ ReferralReward : "generates"
    
    User ||--o{ ReferralRedemption : "redeems"
    User ||--o{ ReferralReward : "earns"
```

### Track-Car Relationship

The relationship between Tracks and Cars is **not a direct foreign key relationship**. Instead:

```mermaid
erDiagram
    Track {
        uuid id PK
        string name
        string[] includedCarIds "Loose reference to Car IDs"
        decimal basePrice
    }
    
    Car {
        uuid id PK
        string name
        string category "ROAD or OFFROAD"
        decimal basePricePerDay
        int stockQuantity
    }
    
    Booking {
        uuid id PK
        uuid trackId FK
        uuid userId FK
        int freeCarsIncluded "Always 2"
        int additionalCarsCount
    }
    
    BookingCar {
        uuid id PK
        uuid bookingId FK
        uuid carId FK
        int quantity
        boolean isFree
        decimal unitPrice
    }
    
    Reservation {
        uuid id PK
        uuid trackId FK
        json selectedCars "Car selections stored as JSON"
    }
    
    Track ||--o{ Booking : "booked for"
    Booking ||--o{ BookingCar : "includes"
    Car ||--o{ BookingCar : "rented in"
    Track ||--o{ Reservation : "held by"
```

**How it works:**

1. **Track.includedCarIds** (`String[]`) - Stores IDs of 2 cars that come "free" with the track rental. This is a loose reference (no FK constraint) allowing flexibility.

2. **Category matching** - Tracks and Cars both have a `category` field (ROAD or OFFROAD). The UI typically filters cars to show only those matching the track's category.

3. **Reservation.selectedCars** (`Json`) - During checkout, car selections are stored as JSON in the reservation. This captures the user's choices before payment.

4. **BookingCar** (junction table) - When payment succeeds, the reservation converts to a booking, and `BookingCar` records are created with proper foreign keys to both `Booking` and `Car`.

### Default Cars Implementation Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Dashboard
    participant API as Track API
    participant DB as Database
    participant User as User Booking Flow

    Note over Admin,DB: Step 1: Admin configures default cars for track
    Admin->>Admin: Create/Edit Track Form
    Admin->>Admin: Select 2 cars (filtered by category)
    Admin->>API: POST /api/admin/tracks
    API->>API: Validate includedCarIds.length === 2
    API->>DB: Verify cars exist & match track category
    API->>DB: Save track with includedCarIds[]
    DB-->>API: Track saved
    
    Note over User,DB: Step 2: User books track
    User->>API: GET /api/tracks/{id}
    API->>DB: Fetch track with includedCarIds
    DB-->>API: Track data
    API-->>User: Track + includedCarIds

    User->>User: Auto-select cars from includedCarIds
    Note right of User: Pre-populates car selection UI
    
    User->>User: Can swap default cars for other matching cars
    User->>API: POST /api/reservations
    API->>DB: Store selectedCars as JSON
    
    Note over User,DB: Step 3: Payment converts to BookingCar records
    API->>DB: Create Booking
    API->>DB: Create BookingCar for each selected car
    Note right of DB: BookingCar.isFree = true for first 2
```

### Admin Track Creation Code

When an admin creates a track, the API validates that:

```typescript
// From app/api/admin/tracks/route.ts
const trackSchema = z.object({
  // ...
  includedCarIds: z.array(z.string().uuid()).length(2, "Must select exactly 2 cars"),
  // ...
})

// Validation: cars must match track category
const cars = await prisma.car.findMany({
  where: { id: { in: validatedData.includedCarIds } }
})

const mismatchedCars = cars.filter(
  (car) => car.category !== validatedData.category
)
if (mismatchedCars.length > 0) {
  return error("Selected cars must match the track category")
}
```

### User Booking Auto-Selection

When a user starts booking, the default cars are pre-selected:

```typescript
// From app/book/page.tsx
if (trackData.track.includedCarIds?.length > 0) {
  // Use the track's specified default cars
  trackData.track.includedCarIds.forEach((carId) => {
    if (matchingCars.some((car) => car.id === carId)) {
      defaultSelectedCars.push({ carId, quantity: 1 })
    }
  })
} else {
  // Fallback: use first 2 matching cars
  matchingCars.slice(0, 2).forEach((car) => {
    defaultSelectedCars.push({ carId: car.id, quantity: 1 })
  })
}
```

**Why this design?**

- **Flexibility**: Tracks can reference any cars without strict coupling
- **Category enforcement**: API validates cars match track category at save time
- **User experience**: Default cars auto-populate the booking form
- **Inventory tracking**: `Car.stockQuantity` allows multiple cars of the same type
- **Pricing clarity**: `BookingCar.isFree` distinguishes included cars from paid extras
- **Fallback behavior**: If `includedCarIds` is empty, system picks first 2 matching cars

---

## See Also

- [README.md](README.md) - Main project documentation
- [e2e/README.md](e2e/README.md) - End-to-end testing guide
- [prisma/schema.prisma](prisma/schema.prisma) - Database schema
