# Plan — Outlet-Centric Reorganization + Email Stack

## 1. Outlet data model (Firestore)

New collection `outlets` (admin-managed):

```text
outlets/{id}
  name: string
  description?: string
  serviceTypes: string[]        // refs to serviceTypes ids
  imageUrl?: string             // uploaded or chosen by service type
  color?: string                // accent color for the card
  address?: string
  phone?: string
  email?: string
  active: boolean
  createdAt, updatedAt, createdBy
```

New collection `serviceTypes` (seeded, editable by admin):
- defaults: `fitness`, `wellness`, `sports`, `membership`, `health`, `events`
- shape: `{ id, name, slug, icon, color, defaultImage, active }`

`companySettings` additions:
- `maxOutlets: number | "unlimited"` (default `"unlimited"`)

Firestore rules: read = authenticated; write = admin only. Seed defaults on first admin visit to setup.

## 2. Setup → Service Types page (admin)

- Sidebar: Setup → Service Types
- Table: name, slug, icon, color, default image, active toggle
- Add/edit/delete; cannot delete if outlets reference it
- Seed the 6 defaults on first load

## 3. Setup → Outlets page (admin)

- Sidebar: Setup → Outlets
- "Add Outlet" form (matches reference image 3, themed dark/gold):
  - Name, description, address, phone, email
  - Image upload (Firebase Storage) or pick from service type default
  - Accent color picker
  - **Service types** multi-select with checkboxes (matches image 2)
  - Active toggle
- List view with edit/deactivate/delete
- Enforce `companySettings.maxOutlets`

## 4. Bookings page — Outlet selector dashboard

When the user navigates to `/bookings`:

1. Show an **Outlet Picker dialog** (modal, blocking) that lists all active outlets as colored cards (image 1 reference):
   - Card: outlet image, name, service-type chips, accent gradient
   - Click → set selected outlet (persisted in localStorage + Zustand-style context) → close modal → render existing Bookings UI scoped to that outlet
2. Top of bookings page: small "Outlet: {name} ▾" pill that re-opens the picker
3. All booking queries gain `where("outletId","==", selectedOutletId)`. Existing bookings without `outletId` shown under a "Legacy" outlet bucket
4. New bookings automatically tagged with `outletId`

If only one outlet exists → auto-select, skip modal.
If zero outlets exist → show empty-state CTA "Ask an admin to create an outlet" / for admins, link to Setup → Outlets.

## 5. Bookings schema migration

- `bookings.outletId: string` (nullable for legacy)
- Update `firebase-services.ts` create/list/update queries
- Update calendar + list views with outlet filter

## 6. Unlayer email editor — finalize

Already wired via `react-email-editor` + `UnlayerEditor.tsx`. Remaining:
- Add a banner in Setup → Email Templates listing what the user must provide:
  - **Unlayer Project ID** (free) — set as `VITE_UNLAYER_PROJECT_ID` env var to remove the demo banner
  - Optional custom fonts/brand kit IDs
- Confirm merge tags pass through (already done)
- Persist `design` JSON + rendered `html` to `emailTemplates` (already done)

Necessary details to provide (will be shown in UI + chat):
1. Unlayer Project ID (sign up at unlayer.com → Projects)
2. (Optional) Brand colors/logo to preset in design
3. Confirm sender email + display name in `companySettings`

## 7. Resend mailing — make functional

Security: the API key cannot live in client code. Use the Lovable Resend connector via the connector gateway (server-side only).

Steps:
1. Connect **Resend** standard connector → user pastes the key once into the secure form (will request via secrets/connector flow, NOT hardcoded)
2. Update existing `functions/src/index.ts` `sendEmail` Cloud Function to call `https://connector-gateway.lovable.dev/resend/emails` with `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${RESEND_API_KEY}`
3. Save the deployed function URL into `companySettings.resendEndpoint`
4. `sendEmailViaResend()` already posts to that endpoint → no client change needed
5. Reminders Cloud Function will then deliver via Resend automatically
6. Add a "Send test email" button in Setup → Email Templates that fires the active template to the admin's own email through the function

> ⚠️ I will **not** paste the raw API key into the codebase. I'll request it through the secure secrets prompt so it's stored server-side only.

## 8. Implementation order

1. Service types collection + Setup page + seed
2. Outlets collection + Setup page (with service-type checkboxes + image)
3. `companySettings.maxOutlets` enforcement
4. Outlet picker modal on `/bookings` + selected-outlet context
5. Scope booking queries/mutations by `outletId`
6. Email Templates setup notes (Unlayer requirements)
7. Resend connector + Cloud Function update + test-email button

## 9. Technical notes

- New files: `src/pages/setup/Outlets.tsx`, `src/pages/setup/ServiceTypes.tsx`, `src/components/OutletPickerDialog.tsx`, `src/contexts/OutletContext.tsx`, `src/lib/firebase-outlets.ts`
- Edited: `src/pages/Bookings.tsx`, `src/components/AppSidebar.tsx`, `src/lib/firebase-services.ts`, `firestore.rules`, `functions/src/index.ts`, `src/pages/EmailTemplates.tsx`, `DATABASE.md`
- Routing: `/setup/outlets`, `/setup/service-types`
- Storage: `outlets/{id}/cover.{ext}` in Firebase Storage
