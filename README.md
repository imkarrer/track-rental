# RC Track Rental

A web application for renting RC car tracks and RC cars for events, with dynamic pricing based on multiple factors and comprehensive booking management.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Available Scripts](#available-scripts)
- [Development Services](#development-services)
- [Seeding Development Data](#seeding-development-data)
- [Admin User Management](#admin-user-management)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Features](#features)
- [Architecture Overview](#architecture-overview) | [Flow Diagrams →](ARCHITECTURE.md)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

Get up and running in 3 steps:

```bash
# 1. Start all services (PostgreSQL, MinIO, MailHog, etc.)
./dev-start.sh

# 2. Seed development data (users, tracks, cars, etc.)
./seed.sh full

# 3. Start the Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Test Credentials:**
| Role  | Email                   | Password      |
|-------|-------------------------|---------------|
| Admin | admin@example.com       | admin123      |
| User  | john.doe@example.com    | password123   |

---

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
- **Git** - [Download](https://git-scm.com/)

### WSL Users (Windows)
This project works great in WSL2. Make sure Docker Desktop is configured to use the WSL2 backend.

---

## Development Setup

### Option 1: One-Command Setup (Recommended)

```bash
# Start all Docker services and see status
./dev-start.sh
```

This will:
- Start PostgreSQL, MinIO, WireMock, MailHog, and Stripe CLI containers
- Display all service URLs and connection info
- Show the Stripe webhook secret

Then in a separate terminal:
```bash
npm run dev
```

### Option 2: Step-by-Step Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   
   Create a new file called `.env.local` with the following configuration:
   ```env
   # Database (uses Docker PostgreSQL)
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rc_track_rental"

   # NextAuth - Generate secret with: openssl rand -base64 32
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here-change-me"

   # Stripe (get from npm run docker:stripe-secret after starting services)
   STRIPE_API_KEY="sk_test_your_key_here"
   STRIPE_WEBHOOK_SECRET="whsec_will_be_shown_after_docker_up"

   # MinIO Storage (uses Docker MinIO)
   S3_ENDPOINT="http://localhost:9000"
   S3_ACCESS_KEY_ID="minioadmin"
   S3_SECRET_ACCESS_KEY="minioadmin"
   S3_BUCKET_NAME="rc-track-rental"
   S3_REGION="us-east-1"

   # Mock services (for local development)
   USE_STRIPE_MOCK=true
   USE_GOOGLE_MAPS_MOCK=true
   USE_EMAIL_MOCK=true
   ```
   
   > **Tip:** See `env.test.example` for a complete list of all available environment variables.

3. **Start Docker services:**
   ```bash
   docker-compose up -d
   # or
   npm run docker:up
   ```

4. **Get Stripe webhook secret:**
   ```bash
   npm run docker:stripe-secret
   ```
   Add it to `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **Set up the database:**
   ```bash
   npm run db:generate    # Generate Prisma client
   npm run db:push        # Push schema to database
   ```

6. **Initialize storage and seed data (optional but recommended):**
   ```bash
   npm run storage:init   # Initialize MinIO bucket
   npm run seed:dev       # Seed test data
   ```

7. **Start the development server:**
   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000)

---

## Available Scripts

### Development
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run dev:full` | Start Docker services + Next.js (one command!) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Testing
| Command | Description |
|---------|-------------|
| `npm run test` | Run unit tests with coverage |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:e2e:ui` | Run e2e tests with Playwright UI |
| `npm run test:e2e:headed` | Run e2e tests in headed browser mode |

### Docker
| Command | Description |
|---------|-------------|
| `npm run docker:up` | Start all Docker services |
| `npm run docker:down` | Stop all Docker services |
| `npm run docker:logs` | View logs from all services |
| `npm run docker:stripe-secret` | Get Stripe webhook secret |

### Database
| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Create and run migrations |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

### Development Data
| Command | Description |
|---------|-------------|
| `npm run seed:dev` | Seed database with test data |
| `npm run storage:init` | Initialize MinIO bucket for images |
| `npm run storage:list` | List images in MinIO |
| `./seed.sh full` | Complete setup: init MinIO + reset DB + seed |
| `./seed.sh reset` | Reset database and seed fresh data |
| `./seed.sh status` | Check database and MinIO status |

### Admin Management
| Command | Description |
|---------|-------------|
| `npm run create-admin` | Create an admin user |
| `npm run check-role` | Check user role |
| `npm run check-user` | Check user details |

### Cron Jobs
| Command | Description |
|---------|-------------|
| `npm run cron:run` | Run all cron jobs |
| `npm run cron:cleanup` | Cleanup expired reservations |
| `npm run cron:reminders` | Send booking reminders |

---

## Development Services

The project uses Docker Compose to run all necessary services:

| Service | URL | Description |
|---------|-----|-------------|
| **PostgreSQL** | `localhost:5432` | Main database |
| **Adminer** | http://localhost:8081 | Database admin UI |
| **MinIO API** | http://localhost:9000 | S3-compatible storage |
| **MinIO Console** | http://localhost:9001 | MinIO web UI |
| **MailHog** | http://localhost:8025 | Email testing UI |
| **WireMock** | http://localhost:8080 | Google Maps API mock |
| **Stripe Mock** | http://localhost:12111 | Stripe API mock |

### Database Access

**Option 1: Adminer (Web-based)**
- URL: http://localhost:8081
- System: PostgreSQL
- Server: `postgres`
- Username: `postgres`
- Password: `postgres`
- Database: `rc_track_rental`

**Option 2: Prisma Studio (Recommended)**
```bash
npm run db:studio
# Opens at http://localhost:5555
```

### MinIO (Image Storage)
- Console: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

### MailHog (Email Testing)
- Web UI: http://localhost:8025
- SMTP: `localhost:1025`
- All emails sent in development mode are captured here

### Stripe Webhooks
The Stripe CLI automatically forwards webhooks to your local app at `/api/webhooks/stripe`.

```bash
# Get your webhook signing secret
npm run docker:stripe-secret
```

---

## Seeding Development Data

### Quick Start

```bash
# Full setup: init MinIO + reset database + seed all data
./seed.sh full
```

### What Gets Seeded

| Category | Items |
|----------|-------|
| **Users** | 4 users (1 admin, 3 regular with addresses) |
| **Tracks** | 4 tracks (road & off-road, with placeholder images) |
| **Cars** | 6 RC cars (various categories, with placeholder images) |
| **Pricing** | Tax rates, day multipliers, fixed costs config |
| **Holidays** | 5 holiday rules (New Year's, July 4th, Christmas, etc.) |
| **Refund Policies** | 5 policies (30+ days: 10%, down to 0-2 days: 100%) |
| **Referral Programs** | User and admin referral configurations |
| **Bookings** | Sample past and upcoming bookings |

### Seed Script Options

```bash
./seed.sh              # Seed data (skip existing)
./seed.sh seed         # Same as above
./seed.sh reset        # Reset DB and seed fresh data
./seed.sh init         # Initialize MinIO bucket only
./seed.sh full         # Full clean setup
./seed.sh status       # Check current status
./seed.sh clean        # Delete all data (careful!)
./seed.sh help         # Show all options
```

### Individual Commands

```bash
npm run storage:init   # Initialize MinIO bucket for images
npm run seed:dev       # Seed database with test data
```

---

## Admin User Management

### Create an Admin User

```bash
npm run create-admin -- admin@example.com mypassword123
```

With custom name:
```bash
npm run create-admin -- admin@example.com mypassword123 "John" "Admin"
```

### Check User Role

```bash
npm run check-role -- user@example.com
```

### Check User Details

```bash
npm run check-user -- user@example.com
```

### Admin Dashboard

Once logged in as an admin, access the dashboard at `/admin`. Features include:
- Booking management (view, modify, cancel, refund)
- Track and car management
- Pricing configuration
- Holiday and day multiplier settings
- Refund policy management
- Referral program configuration
- Analytics and reporting

---

## Project Structure

```
rc-track-rental/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── admin/          # Admin API endpoints
│   │   ├── auth/           # Authentication endpoints
│   │   ├── bookings/       # Booking management
│   │   ├── reservations/   # Reservation handling
│   │   ├── webhooks/       # Stripe webhooks
│   │   └── ...
│   ├── admin/              # Admin dashboard pages
│   ├── auth/               # Auth pages (login, register)
│   ├── book/               # Booking flow
│   ├── bookings/           # User bookings management
│   ├── profile/            # User profile
│   ├── shop/               # Browse tracks and cars
│   └── tracks/             # Track details
├── components/             # React components
├── lib/                    # Utility libraries
│   ├── auth/               # Authentication utilities
│   ├── availability/       # Availability checking
│   ├── booking/            # Booking logic
│   ├── date/               # Date formatting utilities
│   ├── db/                 # Database client
│   ├── email/              # Email sending
│   ├── pricing/            # Pricing calculations
│   ├── referrals/          # Referral system
│   ├── refunds/            # Refund calculations
│   ├── storage/            # MinIO/S3 storage
│   └── stripe/             # Stripe integration
├── prisma/                 # Database schema
├── scripts/                # Utility scripts
├── tests/                  # Unit tests
├── e2e/                    # End-to-end tests
├── types/                  # TypeScript type definitions
└── wiremock/               # WireMock stubs for Google Maps
```

---

## Testing

### Unit Tests

```bash
# Run all tests with coverage
npm run test

# Run in watch mode
npm run test:watch

# Run specific test file
npm run test -- pricing-calculate.test.ts
```

### End-to-End Tests

The e2e tests use Playwright and test the complete booking lifecycle.

```bash
# Run all e2e tests (starts services automatically)
npm run test:e2e

# Run with Playwright UI
npm run test:e2e:ui

# Run in headed mode (see the browser)
npm run test:e2e:headed
```

**E2E Setup:**
1. Copy the example environment:
   ```bash
   cp env.test.example .env.test.local
   ```

2. Configure test credentials in `.env.test.local`

3. Run tests:
   ```bash
   npm run test:e2e
   ```

See `e2e/README.md` for more details.

---

## Features

This is a complete, production-ready application with:

| Feature | Description |
|---------|-------------|
| **Booking System** | Reserve tracks and cars with real-time availability |
| **Payment Integration** | Stripe payment processing with webhooks |
| **Admin Dashboard** | Comprehensive management interface |
| **Dynamic Pricing** | Distance-based, multi-day, holiday, and day-of-week pricing |
| **Referral System** | User referrals with promo codes and rewards |
| **Email Notifications** | Booking confirmations and reminders via MailHog (dev) |
| **SMS Notifications** | Optional SMS booking reminders |
| **Cron Jobs** | Automated cleanup and reminder emails |
| **Shop System** | Browse and rent tracks and RC cars |
| **Booking Modifications** | Reschedule or modify bookings with price adjustments |
| **Refund Policies** | Configurable refund policies based on days before event |

---

## Architecture Overview

### Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL with Prisma ORM
- **Payments:** Stripe
- **Storage:** MinIO (S3-compatible) for images
- **Auth:** NextAuth.js with credentials provider
- **Styling:** Tailwind CSS
- **Forms:** React Hook Form + Zod validation
- **Testing:** Vitest (unit), Playwright (e2e)

### Key Patterns

- **API Routes:** All backend logic in `/app/api/`
- **Server Components:** Used throughout for optimal performance
- **Prisma Date Handling:** String comparisons for `@db.Date` fields to avoid timezone bugs (see `.cursor/rules/date-handling-rule/RULE.md`)

### Flow Diagrams

For detailed sequence diagrams of user and admin operations, see **[ARCHITECTURE.md](ARCHITECTURE.md)**:

- **User Operations:** Registration, booking a track, modifying bookings, cancellations
- **Admin Operations:** Booking management, refunds, track/car management
- **Payment Flows:** Stripe webhook processing, reservation-to-booking conversion
- **Cron Jobs:** Cleanup tasks, reminder notifications

---

## Production Deployment

### Environment Variables

For production, set these environment variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="<generate-a-secure-secret>"

# Stripe
STRIPE_API_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Storage (Vercel Blob or S3)
S3_ENDPOINT="..."
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="..."

# Email (real SMTP)
SMTP_HOST="..."
SMTP_PORT="..."
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="..."

# Google Maps
GOOGLE_MAPS_API_KEY="..."
```

### Deployment Checklist

1. Set all production environment variables
2. Run database migrations: `npm run db:migrate`
3. Configure Stripe webhooks to point to production URL
4. Set up cron jobs for cleanup and reminders
5. Configure email service (SendGrid, SES, etc.)
6. Set up monitoring and error tracking

### Vercel Deployment

The project includes a `vercel.json` with cron job configuration. Deploy directly from GitHub for automatic deployments.

---

## Troubleshooting

### Docker Services Won't Start

```bash
# Check if Docker is running
docker ps

# Restart services
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Database Connection Issues

```bash
# Reset database volumes
docker-compose down -v
docker-compose up -d postgres

# Re-push schema
npm run db:push
```

### Stripe Webhook Secret Not Found

```bash
# Wait for Stripe CLI to initialize (may take 30s)
sleep 30
npm run docker:stripe-secret
```

### MinIO Bucket Not Found

```bash
# Initialize the bucket
npm run storage:init
```

### Port Already in Use

```bash
# Find and kill process on port 3000
npx kill-port 3000

# Or check what's using the port
lsof -i :3000
```

### Schema Changes Not Reflected

```bash
# Regenerate Prisma client
npm run db:generate

# Push schema changes
npm run db:push
```

### Tests Failing

```bash
# Make sure services are running
./dev-start.sh

# For e2e tests, check the test user exists
npm run seed:dev

# Run with verbose output
npm run test -- --verbose
```

---

## License

Private - All rights reserved.
