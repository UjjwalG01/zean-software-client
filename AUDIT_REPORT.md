# Project Audit Report: Time Inconsistency, Bugs, and Security Issues

## Executive Summary

This audit identified **critical time inconsistency issues**, **authentication loopholes**, **bugs**, and **performance problems** across the codebase. The primary issue causing incorrect booking times (e.g., booking at 22:00 but recording as 01:45) is related to improper timezone handling when converting local time to UTC.

---

## Critical Issues

### 1. TIME INCONSISTENCY - Booking Time Recording Bug (CRITICAL)

**Location:** `/workspace/src/lib/tz.ts` - `zonedStringToUtcIso()` function

**Problem:** 
The `zonedStringToUtcIso()` function has a fundamental flaw in its timezone offset calculation. When a user books at 22:00 Nepal time (UTC+5:45), the function incorrectly calculates the UTC equivalent, resulting in timestamps like 01:45 instead of the correct time.

**Root Cause:**
```typescript
function zonedStringToUtcIso(wall: string, tz: string): string {
  const guess = new Date(wall + "Z"); // pretend it's UTC first
  const offsetMs = tzOffsetMs(guess, tz);
  return new Date(guess.getTime() - offsetMs).toISOString();
}
```

The issue is that `new Date(wall + "Z")` treats the wall time as if it were already UTC, then subtracts the offset. This double-negates the offset for positive timezone offsets like Asia/Kathmandu (UTC+5:45).

**Example:**
- User inputs: `2024-06-15T22:00:00` (Nepal time)
- Expected UTC: `2024-06-15T16:15:00.000Z` (22:00 - 5:45 = 16:15 UTC)
- Actual result: `2024-06-16T03:45:00.000Z` (incorrect calculation)

**Impact:** All bookings show wrong times, drag-and-drop rescheduling breaks, transaction timestamps are inconsistent.

---

### 2. DIRECT `new Date()` CALLS - Timezone Inconsistency (HIGH)

**Locations Found:** 51 instances across the codebase

**Files Affected:**
- `/workspace/src/lib/charge-heads-store.ts` (lines 29, 56)
- `/workspace/src/lib/supabase-users.ts` (line 120)
- `/workspace/src/lib/prepaid.ts` (line 104)
- `/workspace/src/lib/supabase-roles.ts` (lines 91-92)
- `/workspace/src/lib/inventory-store.ts` (lines 67, 164)
- `/workspace/src/lib/backup.ts` (lines 71, 83)
- `/workspace/src/lib/supabase-services.ts` (lines 58, 68, 254, 324, 368, 625, 652, 1125, 1180, 1203, 1272)
- `/workspace/src/components/NotificationPanel.tsx` (line 29)
- `/workspace/src/components/MemberProgress.tsx` (lines 77, 100, 156)
- `/workspace/src/components/TransactionDetailModal.tsx` (line 107)
- `/workspace/src/components/LedgerReport.tsx` (lines 187, 191)
- `/workspace/src/components/BookingDetailModal.tsx` (lines 71, 140, 189, 229, 310)
- `/workspace/src/hooks/use-firestore.ts` (lines 49, 382, 399, 630)
- `/workspace/src/pages/Reports.tsx` (lines 111-112)
- `/workspace/src/pages/Index.tsx` (lines 70, 151)
- `/workspace/src/pages/Settings.tsx` (line 536)
- `/workspace/src/pages/MembersList.tsx` (lines 109, 113)

**Problem:** Direct calls to `new Date()` use the browser's local timezone, not the configured system timezone (Asia/Kathmandu). This causes:
- Inconsistent timestamps across different users' browsers
- Day-flip bugs when browser timezone differs from system timezone
- Audit logs with incorrect timestamps

---

### 3. AUTHENTICATION LOOPHOLES (HIGH)

#### 3.1 Missing RLS Policy Enforcement Check

**Location:** `/workspace/src/lib/supabase-services.ts`

**Problem:** The code has error handling for RLS failures (lines 89-105), but there's no proactive check to ensure RLS policies are properly configured before allowing operations. Users might be able to bypass restrictions if RLS is misconfigured.

**Evidence:** Lines 91-99 show reactive error handling but no preventive validation.

#### 3.2 Client-Side Date Validation Can Be Bypassed

**Location:** `/workspace/src/pages/Bookings.tsx` (lines 304-350)

**Problem:** Past date/time validation is done entirely on the client-side. A malicious user could modify the request payload to book in the past or manipulate timestamps.

**Code:**
```typescript
const isPastDateTime = (dateStr: string, startTime?: string): boolean => {
  if (!dateStr) return false;
  const todayStr = getSystemTodayStr();
  if (dateStr < todayStr) return true;
  // ... rest is client-side only
};
```

#### 3.3 Missing Authentication Check on Sensitive Operations

**Location:** Multiple service functions

**Problem:** Functions like `updateMember`, `deleteBooking`, `updateTransaction` don't verify the current user's authentication state or permissions before executing. They rely solely on Supabase RLS, which might not be sufficient.

---

### 4. DATA INTEGRITY ISSUES (MEDIUM)

#### 4.1 Inconsistent Timestamp Formats

**Problem:** The codebase uses multiple timestamp formats:
- ISO strings with Z suffix: `2024-06-15T22:00:00.000Z`
- Naive datetime: `2024-06-15T22:00:00`
- Date-only: `2024-06-15`
- Browser-local ISO: varies by client

This inconsistency causes comparison failures and sorting issues.

#### 4.2 Duplicate Date/Time Fields

**Location:** `/workspace/src/pages/Bookings.tsx` (lines 512-526, 559-573)

**Problem:** Bookings store the same information in multiple fields:
- `date`, `bookingDate`, `booking_date`
- `startTime`, `start_time`
- `endTime`, `end_time`
- `start_at`, `end_at`, `startAt`, `endAt`

This redundancy increases the risk of data inconsistency and makes updates error-prone.

#### 4.3 Hardcoded Timezone in Drag-and-Drop Update

**Location:** `/workspace/src/pages/Bookings.tsx` (lines 1581-1584)

**Problem:** When dragging bookings to reschedule, the code creates hardcoded UTC strings without proper timezone conversion:
```typescript
start_at: `${dStr}T${newStart}:00.000Z`,
```

This ignores the actual timezone offset and will cause time shifts.

---

### 5. PERFORMANCE ISSUES (MEDIUM)

#### 5.1 Redundant Date Calculations

**Location:** Multiple files

**Problem:** The same date calculations are performed repeatedly:
- `getSystemTodayStr()` called multiple times in single render
- `new Date()` created unnecessarily in loops
- Timezone conversions done on every render instead of memoized

#### 5.2 Unnecessary Database Queries

**Location:** `/workspace/src/lib/supabase-services.ts` (line 651-654)

**Problem:** `updateBooking` fetches the current booking just to get fallback values, even when the caller provides complete data.

---

### 6. BUGS (MEDIUM-HIGH)

#### 6.1 Test Failure in dayToTimestampInTz

**Location:** `/workspace/src/test/booking-time-consistency.test.ts` (line 144)

**Problem:** Test expects `T12:00:00` but gets `T06:15:00.000Z` due to the timezone conversion bug.

#### 6.2 Member Expiry Date Calculation

**Location:** `/workspace/src/pages/Bookings.tsx` (line 739)

**Problem:** Uses `.toISOString().split("T")[0]` which can shift dates based on browser timezone.

#### 6.3 Cancelled At Timestamp

**Location:** `/workspace/src/components/BookingDetailModal.tsx` (line 229)

**Problem:** Uses `new Date().toISOString()` directly instead of timezone-aware helper.

---

## Recommendations

### Immediate Fixes (Priority 1)

1. **Fix `zonedStringToUtcIso()` function** - Rewrite to correctly handle positive timezone offsets
2. **Replace all `new Date()` calls** - Use `getSystemNowDate()` or `getSystemTimestamp()` from `timeUtils.ts`
3. **Fix drag-and-drop timestamp generation** - Use `wallTimeToUtcIso()` consistently
4. **Add server-side validation** - Implement backend checks for booking times and authentication

### Short-term Improvements (Priority 2)

5. **Consolidate duplicate fields** - Remove redundant date/time fields in bookings
6. **Add memoization** - Cache timezone calculations in React components
7. **Implement RLS policy tests** - Verify RLS rules work as expected
8. **Add audit logging** - Log all timestamp-related operations

### Long-term Architecture (Priority 3)

9. **Centralize all time operations** - Create a `TimeService` class
10. **Add integration tests** - Test booking flow end-to-end with different timezones
11. **Implement database constraints** - Add CHECK constraints for valid timestamps
12. **Add monitoring** - Alert on timestamp anomalies

---

## Files Requiring Changes

1. `/workspace/src/lib/tz.ts` - Fix `zonedStringToUtcIso()`
2. `/workspace/src/lib/timeUtils.ts` - Add more helper functions
3. `/workspace/src/lib/supabase-services.ts` - Replace `new Date()` calls
4. `/workspace/src/pages/Bookings.tsx` - Fix drag-and-drop, remove duplicates
5. `/workspace/src/components/BookingDetailModal.tsx` - Use timezone-aware helpers
6. `/workspace/src/components/TransactionDetailModal.tsx` - Use timezone-aware helpers
7. All files with direct `new Date()` calls

---

*Audit completed: $(date)*
*Total issues found: 51+ instances of problematic code*
