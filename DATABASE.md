# VitaFit Club — Database Reference

This is the single source of truth for collection / table names used across
the app. Firestore is the active backend; the equivalent Prisma schema for
a future relational migration lives in `prisma/schema.prisma`.

## Firestore ↔ Prisma mapping

| Firestore collection | Prisma model     | Purpose                                              |
| -------------------- | ---------------- | ---------------------------------------------------- |
| `appUsers`           | `AppUser`        | Application logins, roles, permissions               |
| `members`            | `Member`         | Gym/spa members, tier, expiry, preferences           |
| `membershipPlans`    | `MembershipPlan` | Plan tiers + duration + price (drives dropdowns)     |
| `services`           | `Service`        | Bookable/sellable services                           |
| `bookings`           | `Booking`        | Class / service bookings (start, end, status)        |
| `payments`           | `Payment`        | Every transaction (invoice, VAT, method, status)     |
| `checkIns`           | `CheckIn`        | Daily attendance — query by date for monthly reports |
| `emailTemplates`     | `EmailTemplate`  | Subject + HTML + Unlayer design JSON                 |
| `emailReminders`     | `EmailReminder`  | Sent log: who, when, channel, status                 |
| `auditLogs`          | `AuditLog`       | Every create/update/delete with actor + diff         |
| `companySettings`    | `CompanySetting` | Single doc `main` — branding, VAT, dropdown options  |

## Keep these field names in sync

The frontend converters (`src/lib/firebase-converters.ts`) and the Prisma
schema use **identical field names** so a future migration is mostly:
1. Run `prisma migrate deploy`
2. Swap the Firestore SDK import for a Prisma client call.

## Required indexes (already encoded in schema)

- `bookings`: by `startAt`, by `(memberId, startAt)`, by `status`
- `payments`: by `paidAt`, by `method`, by `(memberId, paidAt)`
- `checkIns`: by `checkInAt`, by `(memberId, checkInAt)` — powers daily &
  monthly attendance reports
- `members`: by `status`, by `tier`, by `expiryDate` — powers expiry alerts
- `auditLogs`: by `createdAt`, by `(entityType, entityId)`, by `actorId`

## Collections you still need to create (if missing)

If the Firebase project was provisioned earlier, the following are **new**
and must be created (any first write auto-creates them in Firestore — no
schema migration needed):

- `appUsers`            ← user management
- `emailTemplates`      ← Unlayer designs + subjects
- `emailReminders`      ← outbound email log
- `auditLogs`           ← compliance / change history
- `checkIns`            ← attendance, per-day docs

For Postgres / Lovable Cloud, run `prisma migrate dev --name init` against
`prisma/schema.prisma`.
