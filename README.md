# VitaFit Club — Project Blueprint & Context Mind Map

A single-document knowledge transfer for handing this codebase to another AI
assistant or engineer. Everything below reflects the current, green-build state
of the repository.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## 1. Architecture & Frontend Workflow

### 1.1 Tech Stack

| Concern           | Choice                                                          |
| ----------------- | --------------------------------------------------------------- |
| Framework         | React 18 + TypeScript 5 (SPA — no Next.js)                      |
| Build tool        | Vite 5 (`@vitejs/plugin-react-swc`), port 8080                  |
| Router            | `react-router-dom` v6 (declarative `<Route>` tree in `App.tsx`) |
| Styling           | Tailwind CSS v3 + shadcn/ui (Radix primitives)                  |
| State — server    | `@tanstack/react-query` v5 (single `QueryClient` at App root)   |
| State — UI/global | React Context (`AuthContext`, `OutletContext`, `ThemeProvider`) |
| Forms             | `react-hook-form` + Zod (used in setup pages/modals)            |
| Charts            | Recharts                                                        |
| Icons             | `lucide-react`                                                  |
| Toasts            | `sonner` + shadcn `use-toast`                                   |
| Backend           | **Supabase** (Postgres + Auth + RLS + edge functions)           |
| Test              | Vitest (`src/test/*`)                                           |
| Lint              | ESLint 9 flat config + `typescript-eslint`                      |

### 1.2 Directory Structure

```
src/
├── App.tsx                  # Router tree, providers (Query, Theme, Auth, Outlet)
├── main.tsx                 # ReactDOM bootstrap
├── index.css                # Tailwind layers + design tokens (dark theme)
├── pages/                   # Route-level screens
│   ├── Index.tsx            # Dashboard "/"
│   ├── MembersList.tsx, AddMember.tsx, MemberProfile.tsx, MemberGRC.tsx
│   ├── Bookings.tsx         # Calendar + booking form
│   ├── Transactions.tsx     # Ledger + settlement/advance flow
│   ├── Attendance.tsx, Forecast.tsx, Reports.tsx, AuditLogs.tsx
│   ├── Inventory.tsx, PlansServices.tsx, EmailTemplates.tsx
│   ├── GeneralSetup.tsx, Settings.tsx, Users.tsx, Login.tsx, NotFound.tsx
│   └── setup/               # Admin sub-pages (Outlets, ChargeHeads, Stores…)
├── components/              # Feature + shared components
│   ├── OutletPOSView.tsx    # POS + "Current Bookings" panel
│   ├── BookingDetailModal.tsx, TransactionDetailModal.tsx
│   ├── DayScheduleDialog.tsx, DayTimelineDialog.tsx
│   ├── AppLayout.tsx, AppSidebar.tsx, TopBar.tsx, RouteGuard.tsx
│   ├── inventory/, ui/ (shadcn primitives)
├── hooks/
│   ├── use-firestore.ts     # ALL react-query hooks (name is legacy)
│   ├── use-charges.ts, use-inventory.ts, use-app-users.ts
│   ├── use-auth.ts, use-permissions.ts
├── lib/
│   ├── timeUtils.ts         # ⭐ Single source of truth for "now"
│   ├── tz.ts                # Low-level timezone primitives
│   ├── supabase.ts          # Client factory
│   ├── supabase-services.ts # DB reads/writes for domain tables
│   ├── supabase-users.ts, supabase-roles.ts, supabase-outlets.ts
│   ├── charges.ts, charge-heads-store.ts, prepaid.ts, member-ledger.ts
│   ├── print-utils.ts       # A4/A5/80mm receipt renderers
│   ├── audit-log.ts, settings.ts, backup.ts, modules.ts, duration.ts
├── contexts/                # AuthContext, OutletContext
├── test/                    # Vitest specs
db/
├── schema.sql               # Consolidated Supabase schema
└── migrations/*.sql         # Timestamped incremental migrations
supabase/functions/          # Edge functions (send-email, admin-reset-password)
```

### 1.3 User Flow & Routing

Routes declared in `src/App.tsx` (wrapped by `RouteGuard` + `AppLayout`):

| Path                                                                                                                 | Screen              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `/login`                                                                                                             | Login               |
| `/`                                                                                                                  | Dashboard (Index)   |
| `/members`, `/members/new`, `/members/:id`, `/members/:id/grc`                                                       | Members             |
| `/bookings`                                                                                                          | Bookings + POS      |
| `/attendance`                                                                                                        | Attendance          |
| `/forecast`                                                                                                          | Revenue forecast    |
| `/transactions`                                                                                                      | Ledger / settlement |
| `/reports`                                                                                                           | Reports             |
| `/inventory`                                                                                                         | Inventory           |
| `/audit-logs`                                                                                                        | Audit trail         |
| `/setup/general\|plans\|users\|email-templates\|outlets\|service-types\|settings\|stores\|item-groups\|charge-heads` | Admin setup         |
| `*`                                                                                                                  | NotFound            |

**Primary workflows**

1. **POS + Booking (Bookings → OutletPOSView).** User picks an outlet in
   `OutletContext`. `OutletPOSView` shows a cart plus a **Current Bookings**
   panel (active bookings for the outlet, excluding `Cancelled`/`Completed`
   and those whose linked charge is settled). Each card has three actions:
   - **View** → opens `BookingDetailModal`.
   - **Billing** → `navigate("/transactions?newPayment=true&bookingId=…&memberId=…&memberName=…&service=…&amount=…&outletId=…&guest=1&chargeId=…")`.
   - **Cancel** → sets booking status to `Cancelled` and voids the linked
     pending `Charge` via `useUpdateTransaction`.
2. **Checkout (Transactions).** On mount, `Transactions.tsx` reads the query
   params above and auto-opens the settlement modal prefilled with member,
   service, amount, and linked booking/charge IDs. Discount, advance, and
   payment-method selection flow into `useAddTransaction` +
   `useUpdateTransaction` (marks the charge settled, updates booking status,
   emits an audit-log entry, and triggers receipt printing via `print-utils`).
3. **Guest Mode.** Sports **and** Fitness outlets accept walk-in "Guest Name"
   entries; validation skips the strict registered-member check when Guest
   Mode is active.
4. **Advance vs Payment receipts.** `print-utils.ts` renders two receipt
   kinds: `payment` (itemized fee table, subtotal → previous balance →
   grand total → advance → discount → net payable → status badge) and
   `advance` (headed "ADVANCE RECEIPT", no breakdown). Paper size (`A4`,
   `A5`, `80mm`) is admin-controlled in `GeneralSetup` and stored on
   `companySettings.bill_paperSize`.
5. **Provisional bill preview.** Pending transactions expose a preview (eye)
   action in `Transactions.tsx` that renders the same receipt through
   `generateStandardReceiptHTML({ provisional: true })`. It is titled
   "PROVISIONAL BILL", shows `UNPAID · PROVISIONAL`, reports zero paid, and
   never mutates a transaction, charge or booking status.
6. **Navigation groups.** `AppSidebar.tsx` renders three groups: **Main**
   (Dashboard, Members, Bookings, Attendance, Transactions, Inventory,
   Reports, Forecast, Audit Logs), **Setup** (Plans & Services, Suppliers,
   Item Groups, Charge Heads, Email Templates) and **Admin** (General Setup,
   Outlets, Service Types, Stores, Users & Roles, Settings, Help). `/setup/help`
   (`src/pages/Help.tsx`) is a static in-app user guide and is exempt from
   `RouteGuard` permission checks.

---

## 2. Database & State Layer

### 2.1 Provider

Supabase (managed Postgres + Auth + RLS + storage + edge functions). Client
is created in `src/lib/supabase.ts` from `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` and consumed by every service module. Auth session
is held in `AuthContext` (subscribes to `supabase.auth.onAuthStateChange`).
RBAC uses a dedicated `user_roles` table + `has_role()` SECURITY DEFINER
function — roles are **never** stored on the profile row.

### 2.2 Core Entities & Relationships

Defined in `db/schema.sql` and evolved by `db/migrations/*.sql`.

```
auth.users ─┬─< user_roles (app_role enum: admin|manager|staff|member)
            └─< app_users (profile, custom role assignment)

outlets ─┬─< services ─< bookings
         ├─< charges (module-scoped charges, ties to bookings + payments)
         ├─< payments (a.k.a. transactions in the UI)
         ├─< inv_items ─< inv_movements
         └─< attendance

members ─┬─< bookings
         ├─< charges
         ├─< payments
         ├─< attendance
         └─< member_grc (extended profile)

membership_plans ─< plan_durations
company_settings   (singleton row — general config incl. bill_paperSize, timezone)
audit_logs         (append-only, JSON diff payload)
```

Enums used by TS mirrors (`src/lib/mock-data.ts`):
`MemberTier`, `ServiceType`, `PaymentStatus`, `MemberStatus`, `PaymentMethod`,
`BookingStatus = "Confirmed" | "Waitlisted" | "NotFixed" | "Completed" | "Cancelled"`.

Every `public` table has explicit `GRANT`s and RLS policies. Sensitive tables
(`user_roles`, `payments`, `audit_logs`) are `authenticated`-only and use
`has_role(auth.uid(),'admin'|'manager')` in policies.

### 2.3 Data Fetching Hooks (`src/hooks/use-firestore.ts`)

Name is legacy — the module is 100% Supabase + React Query. All hooks share
a `QueryClient` mounted in `App.tsx`. Convention: reads use `useQuery` with
stable `queryKey` arrays; writes use `useMutation` and invalidate the
matching keys.

| Domain       | Queries                                      | Mutations                                               |
| ------------ | -------------------------------------------- | ------------------------------------------------------- |
| Members      | `useMembers`, `useMember`, `useExpiryAlerts` | `useAddMember`, `useUpdateMember`, `useDeleteMember`    |
| Bookings     | `useBookings({service?,outletId?,date?})`    | `useAddBooking`, `useUpdateBooking`, `useDeleteBooking` |
| Transactions | `useTransactions({outletId?})`               | `useAddTransaction`, `useUpdateTransaction`             |
| Attendance   | `useCheckIns`                                | `useAddCheckIn`                                         |
| Services     | `useServiceTypes`, `useServices`             | `useAddService`, `useUpdateService`, `useDeleteService` |
| Plans        | `useMembershipPlans`, `usePlanDurations`     | `useAdd/Update/DeleteMembershipPlan`, `…PlanDuration`   |
| Settings     | `useCompanySettings`, `useDiscountRules`     | `useSaveCompanySettings`, `useSaveDiscountRules`        |
| Dashboard    | `useDashboardStats`                          | —                                                       |

Additional hooks: `use-charges.ts` (charges table), `use-inventory.ts`,
`use-app-users.ts`, `use-auth.ts`, `use-permissions.ts`.

Caching/revalidation: default `staleTime: 0`, mutations call
`queryClient.invalidateQueries({ queryKey: [...] })` for affected domains
(e.g. settling a payment invalidates `["transactions"]`, `["bookings"]`,
`["charges"]`, and `["member", id]`).

---

## 3. Core Constraints & Single Source of Truth

### 3.1 Timezone & Date Handling — **STRICT**

- **`src/lib/timeUtils.ts` is the single source of truth for "now".**
  Every current-moment read in feature code MUST use one of:
  - `getSystemNowDate(): Date`
  - `getSystemTodayStr(): "YYYY-MM-DD"`
  - `getSystemTimeStr(): "HH:mm"`
  - `getSystemTimestamp(): "YYYY-MM-DDTHH:mm:ss"`
  - `getSystemMonthStr(): "YYYY-MM"`
  - `SYSTEM_TZ = "Asia/Kathmandu"`
- `src/lib/tz.ts` holds low-level primitives (`toIsoDayInTz`,
  `dayToTimestampInTz`, `wallTimeToUtcIso`, `formatInTz`, `nowIso`,
  `getAppTimezone`). Feature code composes these with `timeUtils.ts`
  helpers — it does **not** call `new Date()` for "now".
- **Prohibited:** raw `new Date()` (zero-arg) anywhere under `src/**` except
  `src/lib/timeUtils.ts`, `src/lib/tz.ts`, and tests. Parsing existing ISO
  strings (`new Date(someIso)`) remains allowed.
- **Enforced by ESLint** (`eslint.config.js`) via a scoped
  `no-restricted-syntax` rule:

  ```js
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "Do not call `new Date()` for current time. Use helpers from '@/lib/timeUtils'."
  }
  ```

  The rule is scoped to `src/**/*.{ts,tsx}` and ignores `timeUtils.ts`,
  `tz.ts`, and test files. Zero violations at HEAD.

- Persisted timestamps (audit logs, DB writes) use `getSystemTimestamp()`
  or `wallTimeToUtcIso(...)` so the wall clock stays anchored to Kathmandu
  regardless of the browser locale.

### 3.2 Data Mutation Guards

- **Bookings.** Past-time creation blocked at UI (compare against
  `getSystemTodayStr()` + `getSystemTimeStr()`). Drag-and-drop reschedule
  must go through `wallTimeToUtcIso` — no hand-rolled `Z`-suffixed strings.
  Booking status transitions are `Confirmed → Completed | Cancelled` (and
  `Waitlisted`, `NotFixed`); `Cancelled` bookings hide from active lists and
  void any linked pending charge.
- **Charges & Payments.** Every settlement mirrors a `charges` row via
  `chargeRowId` and links back to the booking via `linkedBookingId` /
  `linkedChargeIds`. `Payment` records with `isSettlement: true` are
  labelled as settlements in ledgers. Voids are non-destructive
  (`voided/voidReason/voidedAt`).
- **Discounts.** Applied at settlement (`Transaction.discount`) — never
  mutated onto the booking's original rate.
- **Guest Mode** applies uniformly to Sports and Fitness outlets; the
  registered-member requirement is bypassed only when Guest Mode is active.
- **Roles.** `user_roles` is the sole authority. RLS policies invoke
  `public.has_role(auth.uid(), 'admin')` — never read a role column off a
  profile.
- **Audit logs** are append-only; timestamps come from `getSystemTimestamp()`.

---

## 4. Recent State Changes & Current Build Status

### 4.1 Recent Refactors — Timezone standardization sweep

Round 1 (previous session): `src/lib/timeUtils.ts`, `src/pages/Bookings.tsx`,
`src/pages/Transactions.tsx`, `src/pages/Attendance.tsx`,
`src/pages/AuditLogs.tsx`, `src/components/DayScheduleDialog.tsx`,
`src/components/DayTimelineDialog.tsx`, `src/lib/audit-log.ts`.

Round 2 (current session — residual sweep):

| File                              | Change                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| `src/lib/backup.ts`               | `toIsoDayInTz(new Date())` → `toIsoDayInTz(getSystemNowDate())` |
| `src/pages/Index.tsx`             | Dashboard `today` memo + greeting-hour use `getSystemNowDate()` |
| `src/pages/Reports.tsx`           | `today` / `monthStart` derived via `getSystemNowDate()`         |
| `src/pages/Settings.tsx`          | Timezone "Now" preview uses `getSystemNowDate()`                |
| `src/pages/MembersList.tsx`       | CSV export filename + date-range stamps via helper              |
| `src/components/LedgerReport.tsx` | CSV export filename + date-range stamps via helper              |

Bad-import fixes required for the Rollup build graph:

| File                                    | Fix                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/lib/supabase-services.ts`          | `getSystemTodayStr` / `getSystemNowDate` imported from `./timeUtils` (previously wrongly from `./tz`) |
| `src/components/BookingDetailModal.tsx` | Same fix for `getSystemNowDate`                                                                       |

ESLint guard added (`eslint.config.js`) — see §3.1.

### 4.2 Feature Additions — "Current Bookings" panel

Location: `src/components/OutletPOSView.tsx`, integrated below the cart in
the outlet POS layout.

- Fetches `useBookings({ outletId })` and `useTransactions()`; filters out
  `Cancelled`, `Completed`, and bookings whose linked charge is
  settled/paid.
- Uses a 3-column grid of cards showing member/guest name, service, and
  time; empty state renders "No active bookings".
- Actions per card: **View** (opens `BookingDetailModal`), **Billing**
  (redirects to `/transactions?newPayment=true&bookingId=…&memberId=…&memberName=…&service=…&amount=…&outletId=…&guest=1&chargeId=…`),
  and **Cancel** (sets booking `status: "Cancelled"` and voids the linked
  pending `Charge` transaction through `useUpdateTransaction`).
- `Transactions.tsx` detects the `newPayment` query params on mount and
  auto-opens the settlement modal prefilled with those values, reusing the
  standard payment workflow (double-submit guard via local `isSubmitting`
  flag included).
- Type support: `BookingStatus` in `src/lib/mock-data.ts` extended with
  `"Completed"` and `"Cancelled"`.

### 4.3 Current Build Integrity

- `npx vite build` → ✅ green (Rollup module graph clean; only pre-existing
  chunk-size and dynamic-import advisory warnings remain).
- `npx tsgo --noEmit` → ✅ clean.
- `npx eslint src` → 0 `no-restricted-syntax` violations (the sole new rule
  from this session). Pre-existing `@typescript-eslint/no-explicit-any`
  warnings are untouched and unrelated to the timezone SoT work.

---

## Appendix — Environment & Runbook

- Dev server: `npm run dev` (Vite on `:8080`, HMR overlay off).
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
- Apply DB: paste `db/schema.sql` into Supabase SQL editor for fresh
  installs; use `db/migrations/*.sql` incrementally for existing ones.
- Edge functions: `supabase/functions/send-email`, `admin-reset-password`.
- Tests: `npx vitest run` (see `src/test/booking-time-consistency.test.ts`).

---

## Appendix — Member Financial Columns & Credit Workflow

### Direct financial columns on `public.members`

| Column | Type | Purpose |
| --- | --- | --- |
| `opening_balance` | `numeric(12,2)` | Legacy carry-over balance at member creation. |
| `total_paid` | `numeric(12,2)` | Lifetime total collected from this member (cash/card/fonepay/etc). |
| `due_amount` | `numeric(12,2)` | Outstanding balance the member owes (incremented on Credit sales). |
| `discount` | `numeric(12,2)` | Cumulative discounts granted. |
| `services` | `text[]` | Enrolled service tags mirrored from the packages picker. |
| `preferences` | `jsonb` (**array**) | Favorite activities — strictly a JSON array. |
| `extras` | `jsonb` (**object**) | Free-form: `plan`, `membershipYears`, `autoRenew`, `logoUrl`, and any other dynamic keys. |

Roll-up SSOT stays the SQL views `vw_member_ledger` +
`member_financial_summaries` (consumed via `useMemberLedger` /
`useMemberFinancials`). The direct columns above are the fast per-member
snapshot written by mutations.

### Credit / Pay-Later settlement flow

1. Booking or manual charge modal offers a `Credit` payment method.
2. Guard: if there is no `memberId` (walk-in guest), the UI blocks the
   sale with the toast **"Walk-in guests cannot pay on credit. Please
   select a registered member."**
3. On accept: the charge/transaction is written with `status: "unpaid"`
   and `method: "credit"`, the ledger records a `credit_hold` audit
   entry, and `members.due_amount` is incremented by the charge total.
4. Later settlement happens via `QuickBalanceModal` or Member Financials
   by recording a Cash/Card/Fonepay payment; the payment reduces
   `due_amount` and lands as a normal credit row in the ledger view.

### Membership enrollment → booking bridge

`PackageSelectionModal` writes a matching row to `public.bookings` when a
plan is picked, populating `rate` (from `plan.price`), `member_package_id`
and `module_id`. The Member Profile → Bookings tab exposes a
**View Details** action that opens `BookingDetailModal` in read-only
mode, so staff can inspect package/price/duration/module/dates without
mutating the plan. The Plan Usage & Attendance Breakdown card
(`PlanUsageWidget` + `useMemberPlanUsage`) reads the same `joinDate` /
`expiryDate` window written by the enrollment step.
