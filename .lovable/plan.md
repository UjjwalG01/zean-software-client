## Goal
Update `src/hooks/use-firestore.ts` to safely handle both UI date format (DD-MM-YYYY) and DB format (YYYY-MM-DD) without relying on external date-parsing assumptions, and default new records to the system date in UI format.

## Scope
Single file: `src/hooks/use-firestore.ts`. No other files touched. No new dependencies; existing `date-fns` / `date-fns-tz` imports stay where still needed (`isSameDay`, `toZonedTime` in `useUpdateBooking`).

## Changes

### 1. Add helpers near the top (after imports/constants)
- `parseUiDate(dateStr)` — returns a `Date | null`:
  - passthrough for `Date` instances
  - `DD-MM-YYYY` → `new Date('YYYY-MM-DDT00:00:00')`
  - `YYYY-MM-DD` → `new Date('YYYY-MM-DDT00:00:00')`
  - fallback `new Date(dateStr)` guarded by `isNaN`
- `getTodayUiString()` — returns today as `DD-MM-YYYY` using local system clock.

### 2. `useAddBooking` mock fallback
Replace `date: data.date || ""` with `date: data.date || getTodayUiString()`.

### 3. `useUpdateBooking` `onMutate`
Replace `const bookingDate = targetDateStr ? new Date(targetDateStr) : systemNow;` with `const bookingDate = parseUiDate(targetDateStr) || systemNow;`. Keep `isSameDay(bookingDate, systemNow)` and the rest of the optimistic merge logic as-is.

### 4. `useAddTransaction` mock fallback
Replace `date: data.date || toIsoDayInTz(new Date())` with `date: data.date || getTodayUiString()`. Leave the `toIsoDayInTz` import in place only if still used elsewhere; otherwise remove the unused import to keep the file clean.

### 5. `useExpiryAlerts` mapping
Replace `const expiry = new Date(m.expiryDate);` with:
```ts
const parsed = parseUiDate(m.expiryDate) || now;
const expiry = new Date(parsed);
```
Keep the `daysLeft` calculation and returned shape unchanged.

## Out of scope
- No changes to Supabase services, components, or other pages.
- No removal of `date-fns` packages from `package.json` (still used by `isSameDay` / `toZonedTime` here and elsewhere across the project).
- No format conversion for values already persisted in the DB — parser handles both shapes at read time.

## Verification
- TypeScript build passes.
- Creating a booking/transaction without an explicit `date` yields a `DD-MM-YYYY` string.
- Rescheduling a booking to a `DD-MM-YYYY` date no longer produces `Invalid Date`, and the today-vs-future status branch still flips correctly.
- Expiry alerts render without NaN `daysLeft` when member `expiryDate` is in UI format.
