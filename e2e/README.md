# E2E Tests

End-to-end tests for the RC Track Rental application using Playwright.

## Quick Start

```bash
# Run all tests (starts services automatically)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed
```

## Setup

### 1. Environment Configuration

Copy the example environment file:

```bash
cp env.test.example .env.test.local
```

Edit `.env.test.local` with your configuration:

```env
# Test user credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123

# Stripe (use test keys)
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rc_track_rental

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
```

### 2. Start Services

Make sure Docker services are running:

```bash
./dev-start.sh
```

### 3. Seed Test Data

```bash
npm run seed:dev
```

### 4. Run Tests

```bash
npm run test:e2e
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test:e2e` | Run all e2e tests (starts services automatically) |
| `npm run test:e2e:ui` | Run with Playwright UI (requires services running) |
| `npm run test:e2e:headed` | Run in headed mode (see the browser) |
| `npm run test:e2e:local` | Run in local development mode |

## What Happens When Tests Run

1. Docker services start (PostgreSQL, Stripe CLI, etc.)
2. Test admin user is seeded automatically
3. Dev server starts on http://localhost:3000
4. Tests run against the local server

## Test Workflow

The main test file (`booking-lifecycle.spec.ts`) exercises the complete booking lifecycle:

```
1. Book a Track
   - Login as test user
   - Select track and date
   - Enter event details
   - Select cars
   - Complete payment

2. Modify Booking
   - Navigate to bookings
   - Click modify
   - Change date/time
   - Save changes (pay difference if needed)

3. Issue Full Refund
   - Open cancel dialog
   - Confirm cancellation
   - Verify refund processed
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `TEST_USER_EMAIL` | Test account email |
| `TEST_USER_PASSWORD` | Test account password |
| `STRIPE_API_KEY` | Stripe test API key |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth secret |

### Optional (have defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_STRIPE_CARD_NUMBER` | 4242424242424242 | Test card number |
| `TEST_STRIPE_CARD_EXPIRY` | 12/34 | Test card expiry |
| `TEST_STRIPE_CARD_CVC` | 123 | Test card CVC |
| `TEST_STRIPE_CARD_ZIP` | 90001 | Test card ZIP |

## File Structure

```
e2e/
├── fixtures/
│   └── auth.ts              # Authentication helpers
├── utils/
│   ├── test-data.ts         # Test data generators
│   └── wait-helpers.ts      # Wait and retry utilities
├── booking-lifecycle.spec.ts # Main test file
└── README.md                # This file

playwright.config.ts         # Playwright configuration
```

## Troubleshooting

### Tests failing to start

```bash
# Make sure dev-start.sh is executable
chmod +x dev-start.sh

# Check Docker is running
docker ps

# Manually start services
./dev-start.sh

# Verify app is running
curl http://localhost:3000
```

### Tests timing out

Increase the timeout in `playwright.config.ts`:

```typescript
webServer: {
  timeout: 180 * 1000, // 3 minutes
}
```

### Database connection errors

```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres

# Run migrations
npm run db:push

# Re-seed data
npm run seed:dev
```

### Stripe payments failing

Make sure the Stripe CLI is running and forwarding webhooks:

```bash
npm run docker:stripe-secret
```

Add the secret to your `.env.test.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Tips

1. **Speed up local tests:** Set `reuseExistingServer: true` in `playwright.config.ts` and keep dev server running

2. **Debug failing tests:** Use `npm run test:e2e:headed` to see browser actions

3. **View test reports:** Run `npx playwright show-report` after tests complete

4. **Update selectors:** When UI changes, update selectors in test files

5. **Clean test data:** Tests create bookings - clean up periodically:
   ```bash
   ./seed.sh reset
   ```

## Production Testing

Test against a deployed production URL:

```bash
# Set production URL
export BASE_URL=https://your-app.vercel.app
export E2E_ENV=production

# Run tests
npm run test:e2e
```

**Note:** Production tests require a test user to exist in the production database.
