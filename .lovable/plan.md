

# Firebase Integration Plan for VitaFit Club

## Overview
Add Firebase (Firestore + Auth) as the backend data layer. All existing UI components remain untouched. A new service layer will sit between the UI and Firebase, with the existing mock data available as a seed script.

## Architecture

```text
UI Components (unchanged)
       │
   React Hooks (new)
       │
   Firebase Services (new)
       │
   Firestore Database
```

## 1. Firebase Setup

**New files:**
- `src/lib/firebase.ts` — Firebase app initialization with config (reads from environment or hardcoded publishable keys: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)
- Install `firebase` npm package

**Firebase config** will use the publishable Firebase client config keys directly in code (these are safe to expose client-side per Firebase docs).

## 2. Firestore Collections (matching provided schema)

Each `@table` type maps to a Firestore collection:

| Collection | Key Fields |
|---|---|
| `users` | name, email, password, roleId |
| `roles` | name, description |
| `permissions` | roleId, module, action |
| `members` | userId, firstName, lastName, email, phone, joiningDate, qrCode, loyaltyYears, autoRenew |
| `membershipTypes` | name, description |
| `membershipPlans` | name, tier, price, durationInMonths, membershipTypeId |
| `membershipPriceHistory` | membershipPlanId, price, effectiveDate |
| `memberMemberships` | memberId, membershipPlanId, startDate, endDate, status, discountApplied, finalPrice |
| `services` | name, type, duration, price, isActive |
| `payments` | memberId, amount, paymentMethod, status, invoiceId |
| `receipts` | paymentId, receiptNo, issuedDate, pdfPath |
| `invoices` | memberId, invoiceNo, subTotal, vatAmount, totalAmount, status |
| `invoiceItems` | invoiceId, serviceId, description, quantity, unitPrice |
| `bookings` | memberId, serviceId, bookingDate, startTime, endTime, status |
| `checkIns` | memberId, checkInTime, checkOutTime, manualEntry |
| `companySettings` | key, value, type |
| `auditLogs` | userId, action, entityType, entityId, oldValue, newValue |
| `memberLedgerEntries` | memberId, description, debit, credit, balance |

## 3. Service Layer

**New file: `src/lib/firebase-services.ts`**
- CRUD functions for each collection (e.g., `getMembers()`, `addMember()`, `updateMember()`, `deleteMember()`)
- Query helpers with filters (by tier, status, date ranges)
- Converts Firestore documents to the existing TypeScript interfaces (`Member`, `Booking`, `Transaction`, etc.) so UI code sees the same shapes

**New file: `src/lib/firebase-converters.ts`**
- Maps between Firestore document format and the existing `mock-data.ts` interfaces
- Ensures the UI receives data in the exact same format it currently expects

## 4. React Hooks

**New file: `src/hooks/use-firestore.ts`**
- `useMembers(filters?)` — returns `{ data: Member[], loading, error }`
- `useBookings(filters?)` — same pattern
- `useTransactions(filters?)` — same pattern
- `useDashboardStats()` — aggregates from Firestore
- `useMember(id)` — single member with related data

These hooks use `@tanstack/react-query` (already installed) with Firebase queries as the fetch function.

## 5. Auth Integration

**New file: `src/lib/firebase-auth.ts`**
- `signIn(email, password)`, `signUp()`, `signOut()`, `signInWithGoogle()`
- Auth state listener

**New file: `src/hooks/use-auth.ts`**
- `useAuth()` hook returning `{ user, loading, signIn, signOut }`

**New file: `src/contexts/AuthContext.tsx`**
- Auth provider wrapping the app (optional login gate for later)

## 6. Data Seeding

**New file: `src/lib/seed-firestore.ts`**
- Converts existing `mock-data.ts` arrays into Firestore documents
- One-time callable function from a dev-only button or console
- Creates all 22 members, bookings, transactions, services, plans, roles, and permissions

## 7. Page Updates (data source only, no UI changes)

Each page currently imports directly from `mock-data.ts`. The plan:
- Replace `import { members } from "@/lib/mock-data"` with the new hooks
- Add loading states using existing skeleton components
- All JSX, styling, layout remain identical
- Toast notifications on mutations (already in place)
- Fallback to mock data if Firebase is not configured

**Pages affected:** `Index.tsx`, `MembersList.tsx`, `MemberProfile.tsx`, `AddMember.tsx`, `Bookings.tsx`, `Transactions.tsx`, `Reports.tsx`, `PlansServices.tsx`, `Settings.tsx`

## 8. Environment Setup

The user will need to:
1. Create a Firebase project in Firebase Console
2. Enable Firestore Database
3. Enable Authentication (Email/Password + Google)
4. Copy the Firebase config object
5. Paste config values into `src/lib/firebase.ts`

## Files Created/Modified Summary

| Action | File |
|---|---|
| Create | `src/lib/firebase.ts` |
| Create | `src/lib/firebase-services.ts` |
| Create | `src/lib/firebase-converters.ts` |
| Create | `src/lib/seed-firestore.ts` |
| Create | `src/lib/firebase-auth.ts` |
| Create | `src/hooks/use-firestore.ts` |
| Create | `src/hooks/use-auth.ts` |
| Create | `src/contexts/AuthContext.tsx` |
| Modify | `src/main.tsx` (wrap with AuthProvider) |
| Modify | `src/pages/Index.tsx` (swap data source) |
| Modify | `src/pages/MembersList.tsx` (swap data source) |
| Modify | `src/pages/MemberProfile.tsx` (swap data source) |
| Modify | `src/pages/AddMember.tsx` (write to Firestore) |
| Modify | `src/pages/Bookings.tsx` (swap data source) |
| Modify | `src/pages/Transactions.tsx` (swap data source) |
| Modify | `src/pages/Reports.tsx` (swap data source) |
| Modify | `src/pages/PlansServices.tsx` (swap data source) |
| Modify | `src/pages/Settings.tsx` (swap data source) |
| Install | `firebase` npm package |

**No UI/styling changes.** All visual output remains identical.

