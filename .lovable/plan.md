

# VitaFit Club — Membership Management System

## Overview
A premium, dark-themed gym/spa/sauna membership management dashboard with mock data. Frontend-only for now, backend can be added later with Supabase.

## 1. App Layout & Theme
- **Dark theme** as default with light mode toggle
- **Sidebar navigation** (collapsible) with logo "VitaFit Club", sections: MAIN (Dashboard, Members, Bookings, Transactions, Reports) and SETUP (Plans & Services, Settings)
- **Top bar** with search input, dark/light toggle, notification bell with badge, and user avatar
- Gold/amber accent colors on dark background matching the reference screenshots

## 2. Dashboard Page
- Welcome greeting with admin name
- **4 stat cards**: Total Members, Monthly Revenue (NPR), Active Bookings, Today's Check-ins — each with icons, values, and change percentages
- **Revenue Overview** line chart (monthly, Jan–Dec) using Recharts
- **Service Breakdown** donut chart (Gym, Spa, Sauna, Swimming percentages)
- **Recent Members** list with tier badges (Platinum, Gold, Silver, Basic)
- **Expiry Alerts** panel showing members expiring soon with countdown

## 3. Members Module
- **Members list page**: Searchable, filterable, sortable table with columns: Name, Email, Phone, Tier, Services, Status, Join Date, Expiry
- Filters: by tier, service type, status (active/expired/expiring)
- **Member profile page**: Photo, personal details, membership info, tier & services, preferences, attendance history chart, payment history table
- **Add/Edit member form**: Multi-step form with personal info, membership selection (tier + services), payment method selection
- Tier badges color-coded: Basic (gray), Silver (silver), Gold (amber), Platinum (emerald)

## 4. Bookings & Calendar Module
- **Calendar view** (React Big Calendar style built with custom components): Monthly/weekly/daily views
- Color-coded by service type (Gym classes, Spa sessions, Sauna slots, Swimming lanes)
- **Booking form dialog**: Select service → date → time slot → member
- **Slot availability** visual indicators (available/limited/full)
- **Booking list view**: Table with search, filter by service/date/status
- **Member booking history** accessible from member profile

## 5. Shared Components
- Reusable **DataTable** with search, sort, filter, pagination
- **StatCard** component for dashboard metrics
- **Badge** variants for tiers and statuses
- **Toast notifications** (Sonner) on all actions
- **Empty states** and loading skeletons
- Fully responsive — mobile sidebar as sheet/drawer

## 6. Mock Data
- 20+ sample members across all tiers
- Sample bookings, transactions, attendance records
- Realistic NPR currency values and Nepali names

## Pages & Routes
- `/` — Dashboard
- `/members` — Members list
- `/members/:id` — Member profile
- `/members/new` — Add member
- `/bookings` — Bookings calendar + list
- `/transactions` — Transactions list (placeholder)
- `/reports` — Reports dashboard (placeholder)
- `/setup/plans` — Plans & services (placeholder)
- `/setup/settings` — Settings (placeholder)

