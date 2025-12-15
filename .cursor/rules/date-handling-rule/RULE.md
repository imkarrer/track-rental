---
description: "Critical: Prevents recurring timezone bugs when comparing Prisma Date fields with @db.Date"
alwaysApply: true
---

# CRITICAL: Prisma Date Field Handling (⚠️ RECURRING BUG)

**This bug has occurred THREE times. Follow these rules strictly.**

## The Problem

Prisma's comparison of JavaScript `Date` objects with PostgreSQL `@db.Date` fields causes timezone-related off-by-one errors.

```typescript
// ❌ WRONG - Will cause timezone bugs
await prisma.booking.findFirst({
  where: {
    eventDate: someDate,  // JavaScript Date vs @db.Date comparison
  }
})
```

This leads to:
- Dates matching when they shouldn't
- Dates not matching when they should
- "Date not available" errors for actually-available dates
- Adjacent date bookings incorrectly blocking each other

## The Solution: ALWAYS Use String Comparisons

### RULE 1: Never compare Date objects in Prisma queries for `@db.Date` fields

```typescript
// ❌ BAD
const booking = await prisma.booking.findFirst({
  where: {
    eventDate: targetDate,
    endDate: { gte: startDate, lte: endDate }
  }
})

// ✅ GOOD - Fetch all, filter with strings in JavaScript
const bookings = await prisma.booking.findMany({
  where: { trackId }
})

const matching = bookings.find(b => {
  const bookingStartStr = toDateStringUTC(b.eventDate)!
  const bookingEndStr = toDateStringUTC(b.endDate || b.eventDate)!
  
  // String comparison is safe: "2025-12-27" < "2025-12-28"
  return bookingStartStr === targetDateStr ||
         (bookingStartStr <= targetDateStr && bookingEndStr >= targetDateStr)
})
```

### RULE 2: Use existing helper functions

Always use these from `lib/date/format.ts`:
- `toDateStringUTC(date: Date): string` - Converts Date to "YYYY-MM-DD" string
- `toUTCStartOfDay(dateStr: string): Date` - Converts "YYYY-MM-DD" to Date at UTC midnight

### RULE 3: Reference implementations

Files that have been fixed and serve as examples:
- ✅ @lib/availability/check.ts - Reference implementation
- ✅ @app/api/reservations/modify/route.ts - Reference implementation
- ✅ @tests/availability-timezone-edge-cases.test.ts - Test patterns

## Affected Database Fields

These Prisma schema fields use `@db.Date` and require string comparison:
- `Booking.eventDate`
- `Booking.endDate`
- `Reservation.eventDate`
- `Reservation.endDate`
- `Holiday.date`

## When to Apply This Rule

Apply this rule whenever you:
1. Query for bookings/reservations by date
2. Check date availability
3. Compare dates for conflicts or overlaps
4. Filter records by date ranges

## Testing Requirements

When working with date queries, ALWAYS:
1. Test with adjacent dates (e.g., Dec 27 → Dec 28)
2. Test with same-day modifications
3. Test with dates spanning timezone boundaries (midnight UTC)
4. Run `npm test -- availability-timezone-edge-cases.test.ts`

## Complete Example

```typescript
// ✅ Correct pattern for checking date conflicts
export async function checkDateAvailability(
  trackId: string,
  startDateStr: string,
  endDateStr: string,
  excludeBookingId?: string
) {
  // Fetch ALL bookings for the track (no date filtering in query)
  const bookings = await prisma.booking.findMany({
    where: {
      trackId,
      status: { in: ["CONFIRMED", "PENDING"] },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
    },
    select: {
      id: true,
      eventDate: true,
      endDate: true,
    },
  })

  const unavailableSet = new Set<string>()

  // Filter in JavaScript using STRING comparison
  for (const booking of bookings) {
    const bookingStartStr = toDateStringUTC(booking.eventDate)!
    const bookingEndStr = toDateStringUTC(booking.endDate || booking.eventDate)!
    
    // Skip bookings outside our date range (string comparison)
    if (bookingEndStr < startDateStr || bookingStartStr > endDateStr) {
      continue
    }

    // Add each day to unavailable set
    const bookingStart = toUTCStartOfDay(bookingStartStr)
    const bookingEnd = toUTCStartOfDay(bookingEndStr)

    let current = new Date(bookingStart)
    while (current <= bookingEnd) {
      unavailableSet.add(toDateStringUTC(current)!)
      current.setUTCDate(current.getUTCDate() + 1)
    }
  }

  return unavailableSet
}
```

## Related Consideration: Unique Constraints on Date Fields

When you have unique constraints like `@@unique([trackId, eventDate, endDate])`, expired records can block new inserts even though they're filtered out by queries.

**Pattern**: Clean up expired records before inserting:

```typescript
// ✅ Delete expired records to avoid unique constraint conflicts
await prisma.reservation.deleteMany({
  where: {
    trackId,
    expiresAt: { lte: new Date() }, // Only delete expired ones
  },
})

// Now safe to create new reservation
await prisma.reservation.create({ ... })
```

**Note**: This is NOT a date comparison issue - it's about database constraint management.

## Documentation

See @FIX_AVAILABILITY_TIMEZONE_BUG.md for detailed history and examples.
