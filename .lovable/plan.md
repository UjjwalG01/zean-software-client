
# VitaFit Club — End-to-End Workflow Refactor

Implementation is ordered by dependency: schema first, then services, then UI, then printing/cleanup. Each phase compiles and ships independently.

---

## Phase 1 — Database (single consolidated SQL)

Deliver one file: `db/schema.sql` (drop-in for a fresh Supabase project, supersedes 0001–0004). It contains:

- **Enums:** `app_role`, `member_status`, `booking_status`, `invoice_status`, `payment_status`, `payment_method`, `gender`, `marital_status`, `blood_group`, `outlet_type`.
- **Core tables (with explicit GRANTs + RLS):**
  - `app_users`, `user_roles` (+ `has_role`, `has_any_role` SECURITY DEFINER fns)
  - `company_settings` (singleton)
  - `outlets`, `service_types`, `outlet_service_types` (join)
  - `members` (global, with JSONB `address {permanent,temporary}`, `emergency_contact {name,phone,address}`, `physical {height,weight,chest,blood_group}`, `medical {heart_stroke bool, breathing_difficulty bool, skin_disease bool}`, `member_preferences text[]`, `photo_url`, `member_code` unique)
  - `member_outlet_access` (member ↔ outlets they've used)
  - `membership_plans`, `services`, `service_packages` (outlet_id nullable = chain-wide)
  - `member_packages` (member's purchased package + remaining sessions + validity + outlet)
  - `employees` (trainer/therapist)
  - `bookings` (member_id, outlet_id, service_id|package_id, employee_id, start_at, end_at, status)
  - `invoices` (member_id, outlet_id, booking_id NULLABLE, totals, status)
  - `invoice_items` (invoice_id, service_id|package_id, qty, price, discount, tax)
  - `payments` (invoice_id, amount, method, status, paid_at) — supports partial
  - `check_ins`, `email_templates`, `email_reminders`, `audit_logs`
- **Functions/triggers:**
  - `generate_member_code()` → `M` + `YY` + sequence (e.g. `M260516`), unique
  - `tg_member_code_before_insert` (auto-assign on insert when null)
  - `tg_touch_updated_at` on all tables with `updated_at`
  - `tg_member_outlet_access_on_booking` (insert/update access row)
  - `tg_member_package_decrement_on_completed_booking`
  - `tg_invoice_totals_recalc` (sum items → invoice totals)
  - `tg_payment_updates_invoice_status` (paid/partial/unpaid)
  - `is_config_value_in_use(category text, value text) returns boolean` — checks references in bookings/members/invoices/etc., used by setup-page delete guard
- **RLS:** auth users CRUD everywhere they need it; admin-only on `user_roles`, `company_settings`, deletes. Public read on `service_types`, `company_settings`.
- **GRANTs:** explicit `GRANT SELECT,INSERT,UPDATE,DELETE … TO authenticated` and `GRANT ALL TO service_role` per table.
- **Storage:** `members` bucket (public read, authenticated write) with RLS.
- **Seeds:** default service types, blood groups, nationalities (in `company_settings.extras.lists`).

Old `db/0001…0004.sql` are kept on disk but `db/schema.sql` is the authoritative one for new installs.

---

## Phase 2 — Service layer (`src/lib/firebase-services.ts` + new modules)

- Replace bespoke `generateGRCNumber` with DB-side `generate_member_code` (trigger does it). Frontend just reads it back.
- New `src/lib/packages.ts`: `listAvailablePackages(outletId)`, `assignPackageToMember(memberId, packageId, outletId, paymentInfo?)`.
- New `src/lib/bookings.ts`: `createBooking({memberId, outletId, serviceOrPackageId, employeeId, startAt})` with capacity check via RPC.
- New `src/lib/invoices.ts`: `createInvoiceFromBooking(bookingId)`, `createDirectInvoice({memberId, outletId, items})`, `recordPayment(invoiceId, amount, method)`.
- Rewrite `mapMemberRow`/`memberPayload` to use the new JSONB columns (`address`, `emergency_contact`, `physical`, `medical`) — no more catch-all `extras` for these.
- Remove unused: GRC number generator, opening_balance/totalPaid duplicates on members (live in invoices), services array on member (moved to packages).
- Add `setupConfig.ts`: CRUD for setup lists (classes, plan durations, packages, blood groups, etc.) backed by `company_settings.extras.lists.<key>` with `isValueInUse(category, value)` calling the SQL function.

---

## Phase 3 — Member registration UI

- `src/pages/AddMember.tsx` — slim multi-step modal (also opens as full page for edit):
  - **Personal:** member_code (read-only, auto), full_name, dob, gender (dropdown), nationality (dropdown from setup), religion, address (permanent + temporary), occupation, photo upload.
  - **Contact:** phone, email, alt contact, office name/address, emergency_contact {name, phone, address} (JSONB form).
  - **Physical & Medical:** height, weight, chest, blood_group (dropdown), heart_stroke (switch), breathing_difficulty (switch), skin_disease (switch), member_preferences (multi-select).
  - **Review & Save** → no package selection here.
- After save, open **PackageSelectionModal** (new component):
  - Outlet dropdown (defaults to current).
  - List of plans/services for that outlet.
  - Pick one → record in `member_packages`, prompt "Collect payment now?" → opens direct billing modal or skip.
- `src/pages/EditMember.tsx` (or reuse AddMember in edit mode) — same multi-tab form, prefilled.
- Remove the old single-page form fields not in the new spec.
- Member changes propagate everywhere via React Query invalidation of `["members"]` and per-member keys (already wired; just ensure new fields are read from JSONB).

---

## Phase 4 — Booking & Billing flows

- `src/pages/Bookings.tsx`: member search by phone/member_code, outlet/service pick, capacity check, status transitions (Pending → Confirmed → Completed/No-show/Cancelled). On Completed, auto-create invoice (Path A).
- `src/pages/Transactions.tsx`: add **"Direct Invoice"** action for walk-ins (Path B, `booking_id=null`).
- Invoice modal supports multiple items (services + package usage), discounts, taxes; payments table supports partial.
- Multi-outlet: every booking/invoice/payment tags `outlet_id`; member profile shows aggregated history & package balance across outlets.

---

## Phase 5 — GRC compact A4 + print isolation

Rewrite `src/pages/MemberGRC.tsx`:
- Compact header (logo 36px, single-line company info), Form No inline.
- Two-column grid; group related fields inline (e.g. "Height / Weight / Chest / Blood Group" on one row).
- Tighter section bars (4px padding), smaller fonts (10–11px body).
- **Print isolation:** dedicated `@media print` that hides everything except `#grc-page`:
  ```css
  @media print {
    body * { visibility: hidden; }
    #grc-page, #grc-page * { visibility: visible; }
    #grc-page { position: absolute; left:0; top:0; width:210mm; }
    @page { size: A4; margin: 8mm; }
  }
  ```
- Empty fields render blank lines (printable for guest fill-in).

---

## Phase 6 — General Setup hardening

Update `src/pages/GeneralSetup.tsx`:
- Each row gets **Edit** + **Delete** actions (currently delete-only).
- On delete, call `is_config_value_in_use(category, value)`; if true, disable button + tooltip "Used in N records — cannot delete."
- Add categories: nationalities, religions, occupations (referenced by member form dropdowns).

---

## Phase 7 — Auth simplification

- `src/pages/Login.tsx` + `firebase-auth.ts`: admin creates user via Supabase admin API → no confirmation email, `email_confirm=true` on signup. Disable Resend "welcome" trigger.
- Update Supabase Auth setting note in README: turn off "Confirm email".

---

## Phase 8 — Cleanup

- Delete dead Firebase code: `firebase.ts`, `seed-firestore.ts`, `firestore.rules`, `functions/`, `firebase.json`, unused converters.
- Rename `firebase-services.ts` → `data-services.ts` (keep re-export shim for one release).
- Strip unused imports/types reported by ESLint.
- Update `DATABASE.md` to point at `db/schema.sql` only.

---

## Technical notes

- **Member code generation** lives in Postgres (sequence + trigger) for true uniqueness across concurrent inserts; client never computes it.
- **JSONB shapes** are validated client-side with Zod; DB stores raw JSONB for flexibility.
- **Capacity check** is an RPC (`check_booking_capacity`) inside a transaction to avoid race conditions.
- **Package decrement** is trigger-driven on `bookings.status = 'completed'` to keep balance consistent regardless of which UI path created the booking.
- **Invoice totals & status** are trigger-driven; payments just insert rows.

## Manual steps for the user (once)

1. In Supabase SQL Editor, run `db/schema.sql` on a fresh project (or apply against existing — it's idempotent where possible).
2. In Supabase Auth settings, disable "Confirm email".
3. Set secret `RESEND_API_KEY` and deploy `send-email` edge function (unchanged).
4. Insert your admin: `insert into public.user_roles(user_id, role) values ('<auth-uid>', 'admin');`

After approval I'll implement phases 1 → 8 in order; each phase leaves the app in a working state.
