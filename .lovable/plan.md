## Global Time Handling Refactor

Goal: every timestamp in the app is read, written, and rendered through one set of helpers tied to a single configured timezone (default `Asia/Kathmandu`). The browser's local clock never influences storage or display. Manual time inputs (booking start/end) stay as user-entered wall-clock strings — no auto-shifting.

---

### 1. Lock the canonical TZ in `src/lib/tz.ts`

- Add `SYSTEM_TZ` constant = `"Asia/Kathmandu"` exported alongside existing helpers.
- Change `getBrowserTimezone()` callers: settings can still override via `setAppTimezone`, but the default seed becomes `SYSTEM_TZ` instead of `Intl…resolvedOptions().timeZone`.
- Add three new helpers (so the rest of the app never touches `toLocale*` again):
  - `formatDateTime(value)` → `dd MMM yyyy, HH:mm` in active TZ
  - `formatDate(value)` → `dd MMM yyyy` in active TZ
  - `formatTime(value)` → `HH:mm` in active TZ
  - `formatMonthShort(value)` → `MMM` in active TZ (replaces `toLocaleString("en",{month:"short"})`)
- Re-export `nowIso()` as the single source for "current instant to persist".

### 2. Database writes — uniform ISO

Audit every insert/update path and replace ad‑hoc date construction with `nowIso()` / `toIsoDayInTz(new Date())`:

- `src/lib/audit-log.ts`, `src/lib/charges.ts`, `src/lib/charge-heads-store.ts`, `src/lib/prepaid.ts`, `src/lib/inventory-store.ts`, `src/lib/supabase-services.ts`, `src/lib/supabase-roles.ts`, `src/lib/supabase-users.ts`, `src/lib/email-templates.ts`, `src/hooks/use-firestore.ts`
- `src/pages/Transactions.tsx` (settle/void/refund handlers) and `src/components/TransactionDetailModal.tsx` already use `toISOString()` — keep, but route through `nowIso()` for grep consistency.
- Day-keyed columns (`bookings.date`, `check_ins.date`, `transactions.date`) always go through `toIsoDayInTz(new Date())` or `dayToTimestampInTz(day)`. No `format(new Date(), "yyyy-MM-dd")` allowed.
- Replace the remaining direct `format(new Date(), "yyyy-MM-dd")` writes in `src/components/OutletPOSView.tsx` and `src/pages/Reports.tsx` (where they feed DB filters) with `toIsoDayInTz(new Date())`.

### 3. Frontend display — purge `toLocale*Date/Time`

Replace every usage with the new tz helpers. Files to touch:

| File | Current call | Replacement |
| --- | --- | --- |
| `src/components/inventory/MovementsDrawer.tsx` | `new Date(m.createdAt).toLocaleString()` | `formatDateTime(m.createdAt)` |
| `src/components/PremiumReportFrame.tsx` | `new Date().toLocaleString()` footer | `formatDateTime(nowIso())` |
| `src/components/MemberProgress.tsx` (HTML report) | `new Date().toLocaleString()` | `formatDateTime(nowIso())` |
| `src/lib/print-utils.ts` | `new Date().toLocaleString()` (3 places) and `new Date(t.date).toLocaleString("en", {month:"long",year:"numeric"})` | `formatDateTime(nowIso())` / `formatInTz(t.date,{month:"long",year:"numeric"})` |
| `src/components/test.html` | inline `toLocaleString()` | static placeholder (template only) |
| `src/pages/Index.tsx` line 99 | `new Date(t.date).toLocaleString("en",{month:"short"})` | `formatMonthShort(t.date)` |
| `src/pages/Reports.tsx` line 311 | same | `formatMonthShort(m.joinDate)` |

Currency `toLocaleString()` calls (Inventory, Bookings, chart tooltip, `formatNPR`) are **not** touched — they format numbers, not dates.

Audit table / ledger / transactions rendering: confirm they already format through `formatInTz` or `format(parseISO(...), …)` derived from ISO. Any `format(new Date(x), …)` that bypasses TZ becomes `formatInTz(x, {...})`.

### 4. Booking time slots — manual only

- `src/pages/Bookings.tsx`: `startTime` / `endTime` remain string fields ("HH:mm") taken from the form. When persisting, build `start_at`/`end_at` with `zonedStringToUtcIso(`${date}T${startTime}:00`, SYSTEM_TZ)` (already happens via `dayToTimestampInTz`-style helper — extend `tz.ts` with `wallTimeToUtcIso(day, hhmm)` and use it inside `addBooking`/`updateBooking`).
- Remove `systemNow`/`toZonedTime(new Date(), SYSTEM_TZ)` derived defaults that auto-pick a slot. The "now" button still works, but only when the user clicks it — no implicit recalculation on render.
- `src/components/DayTimelineDialog.tsx`, `src/components/DayScheduleDialog.tsx`: the red "current time" line is computed once on open from `toZonedTime(new Date(), SYSTEM_TZ)`; keep it but never use it to mutate booking data.
- `src/components/OutletPOSView.tsx`: `const now = format(new Date(),"HH:mm")` is only used as a default input value — keep, but source from `formatTime(nowIso())` so it respects the configured TZ.

### 5. Verification

- `rg "toLocaleDateString|toLocaleTimeString|toLocaleString\(\)" src` returns only number-formatting cases (currency, chart tooltips).
- `rg "new Date\(.*\)\.toISOString\(\)" src` — every hit lives inside `tz.ts` or is wrapped by `nowIso()`.
- Manual smoke test in browser with device TZ forced to `America/New_York`: a booking entered as 18:00 still renders 18:00 in the calendar, the audit log, and the printed GRC; transactions created "today" stay on today's date in the ledger.
- TypeScript build passes (no `any` introduced; helpers typed `(value: string | Date) => string`).

### Out of scope

- SQL migrations / column types — DB already stores `timestamptz`.
- Number `toLocaleString` calls used for currency formatting.
- Changing the user-visible date format strings beyond what's required to route through tz helpers.
