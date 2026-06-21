# Step-by-step manual refactor

Work through these in order. Each step lists the **file**, the **lines/area** to touch, and the **exact change**. Nothing here is auto-applied — you do it yourself.

---

## PART A — Remove the Time-Slot feature (Morning / Day / Evening)

### A1. Booking creation flow — `src/pages/Bookings.tsx`

1. **Delete the slot→time map** at lines 95–99:
  ```ts
   const TIME_SLOT_DEFAULT: Record<string,string> = {
     Morning: "06:00", Day: "12:00", Evening: "18:00",
   };
  ```
2. **Delete the setup list** at lines 248–252 (`setupTimeSlots = parseSetup(... "setup_timeSlots" ...)`) and every reference to `setupTimeSlots`.
3. Remove the state hook `bookTimeSlot` / `setBookTimeSlot` (search the file) and any `<Select>` UI in the Add/Edit booking dialog labelled "Time Slot".
4. In `handleSubmit` (line 470) and the duplicate insert path (line 500), drop the `timeSlot: bookTimeSlot || start,` line.
5. In the drag-reschedule handler (~line 1308), drop `timeSlot: newStart,` as well.
6. At line 370 (`setBookTimeSlot((b as any).timeSlot || …)`) remove the entire line.

&nbsp;

## Important thing to note: 

## The time slot {morning, day, end} should be removed and in the time slot input field, the selected time range should be default value in readonly mode. So while amend and drag the booking in day scheduler, the time slot must be updated with the book start time and book end time. The date must be strictly pulled from the saved date timestamps and GMT from the settings. 

Ensure that the time slot ui is not removed instead, it should be readonly mode, where value comes from the selected start and end time. 

>> Also update the GRC time with the time slot to be {start time - end time}. If anything conflicts with this, take this statement as final.

### A2. Package selection — `src/components/PackageSelectionModal.tsx`

- Lines 39, 44, 48, 66, 105–107: remove `timeSlots`, the `timeSlot` state, the `useEffect` that seeds it, the field in the payload (line 66), and the `<Select>` block (lines 105–107).

### A3. POS view — `src/components/OutletPOSView.tsx`

- Line 200: delete `timeSlot: now,` from the object literal.

### A4. Member type & extras — keep only the schema-mapped fields

- `src/lib/mock-data.ts` line 72: delete `timeSlot?: string;` from the `Member` interface.
- `src/lib/supabase-services.ts` line 122: remove `"timeSlot",` from `EXTRA_KEYS`.

### A5. GRC print — `src/pages/MemberGRC.tsx`

- Lines 61–64: delete the `timeSlots = parseList(... "setup_timeSlots" ...)` block.
- Line 618: delete the `<F label="Time Slot" value={m.timeSlot} opts={timeSlots} />` row from the printable form.

### A6. Attendance display — `src/pages/Attendance.tsx`

- Line 381: remove the `{m.timeSlot}` cell (and its surrounding `<td>`/header so columns stay aligned).

### A7. General Setup admin — `src/pages/GeneralSetup.tsx`

- Lines 107–110 and lines 144–147: delete the `timeSlots` `useSetupList` and the matching config block (`key: "timeSlots"`, `cat: "setup_timeSlots"`). This removes the admin editor for the now-defunct list.

### A8. Mock & seed data

- `src/lib/mock-data.ts`: remove any `timeSlot:` keys from seed member objects (grep `timeSlot:` inside the file).
- `src/pages/EmailTemplates.tsx` line 42 (`className: "Morning Yoga"`) is just sample copy — leave it unless you want to rename.

### A9. (Optional, after deploy) database cleanup

Run once in the SQL editor; `extras` is JSONB so no DDL is needed:

```sql
update public.members set extras = extras - 'timeSlot' where extras ? 'timeSlot';
```

Also delete the row from your `settings` table where `category = 'setup_timeSlots'`.

---

## PART B — Align `bookings` mapping with the real schema

The current code in `src/lib/supabase-services.ts` (lines 566–649) only reads/writes a tiny subset of the booking columns and crams `service`, `className`, `instructor` into a stringified `notes` JSON. The schema gives each of those a dedicated column. Refactor as follows:

### B1. Extend the `Booking` type — `src/lib/mock-data.ts`

Add the missing fields to the interface (all optional except the existing ones):

```ts
serviceId?: string;
serviceType?: string;       // already exists on some rows — make canonical
employeeId?: string;
memberPackageId?: string;
moduleId?: string;
originalRate?: number;
rate?: number;
discountAmount?: number;
discountReason?: string;
cancelReason?: string;
cancelledAt?: string;
amendedFrom?: string;
```

### B2. Replace `mapBookingRow` (lines 566–591)

Map every column directly — stop parsing `notes` for primary data:

```ts
function mapBookingRow(r: any): Booking {
  const rawStatus = r.booking_status ?? r.status;
  return {
    id: r.id,
    memberId: r.member_id || "",
    memberName: r.member_name || "",
    serviceId: r.service_id || "",
    service: (r.service_type || "Gym") as ServiceType,
    serviceType: r.service_type || "",
    className: r.class_name || r.service_name || "",
    instructor: r.instructor || "",
    employeeId: r.employee_id || "",
    memberPackageId: r.member_package_id || "",
    moduleId: r.module_id || "",
    outletId: r.outlet_id || null,
    date: dateOnly(r.start_at ?? r.start_time),
    startTime: timeOnly(r.start_time ?? r.start_at),
    endTime: timeOnly(r.end_time ?? r.end_at),
    status: dbStatusToDisplay(rawStatus) as BookingStatus,
    originalRate: Number(r.original_rate ?? 0),
    rate: Number(r.rate ?? 0),
    discountAmount: Number(r.discount_amount ?? 0),
    discountReason: r.discount_reason || "",
    cancelReason: r.cancel_reason || "",
    cancelledAt: r.cancelled_at || "",
    amendedFrom: r.amended_from || "",
  } as any;
}
```

### B3. Rewrite `addBooking` (lines 604–626)

Write to dedicated columns; populate **both** `start_at`/`end_at` and `start_time`/`end_time` (the exclusion constraint uses `start_time`/`end_time`):

```ts
const startTs = at(data.date, data.startTime);
const endTs   = at(data.date, data.endTime || data.startTime);
const insert = {
  member_id: data.memberId || null,
  member_name: data.memberName || null,
  service_id: (data as any).serviceId || null,
  service_name: data.className || null,
  service_type: data.service || null,
  class_name: data.className || null,
  instructor: data.instructor || null,
  employee_id: (data as any).employeeId || null,
  member_package_id: (data as any).memberPackageId || null,
  module_id: (data as any).moduleId || null,
  outlet_id: data.outletId || null,
  start_at: startTs, end_at: endTs,
  start_time: startTs, end_time: endTs,
  original_rate: (data as any).originalRate ?? null,
  rate: (data as any).rate ?? null,
  discount_amount: (data as any).discountAmount ?? 0,
  discount_reason: (data as any).discountReason || null,
  booking_status: displayStatusToDb(data.status || "Confirmed"),
  notes: typeof data.notes === "string" ? data.notes : null,
};
```

Remove the JSON-stringified `notes` payload — `notes` is plain `text` in the schema and should hold free-form notes only.

### B4. Rewrite `updateBooking` (lines 628–643)

Mirror B3: map each camelCase key to its column, and when `date`/`startTime`/`endTime` change update **both** the `_at` and `_time` pair. Add patches for the new fields (`rate`, `originalRate`, `discountAmount`, `discountReason`, `cancelReason`, `cancelledAt`, `serviceId`, `serviceType`, `instructor`, `moduleId`, `employeeId`, `memberPackageId`).

### B5. Cancellation path

Wherever the UI sets a booking to "NotFixed"/cancelled, also pass `cancelReason` and stamp `cancelledAt: new Date().toISOString()` so the new columns are populated.

---

## PART C — Align `members` mapping with the real schema

Most member fields are already mapped (see lines 147–301). Three gaps remain — fix them so legacy `extras` shims can finally be retired:

### C1. `member_code` & `marital_status`

- In `mapMemberRow` add: `memberCode: r.member_code || "",` and `maritalStatus: r.marital_status || extras.maritalStatus || "",`.
- In `memberPayload` add: `member_code: data.memberCode || undefined,` (let the trigger fill it) and `marital_status: (data as any).maritalStatus || null,`.
- Remove `"maritalStatus"` from `EXTRA_KEYS` (line 107).

### C2. `member_preferences` text[]

The DB column is `member_preferences text[]`, but the code currently shoves the array inside the `preferences` JSONB blob. Add:

```ts
member_preferences: Array.isArray(data.preferences) ? data.preferences : [],
```

to `memberPayload`, and read it back in `mapMemberRow` with `Array.isArray(r.member_preferences) ? r.member_preferences : prefs.preferences || []`.

### C3. `plan_id`

Add column mapping:

- read: `planId: r.plan_id || "",`
- write: `plan_id: data.planId || null,` in both insert & update paths.

### C4. After this refactor, `extras` should only contain

`residenceStatus, nationalId, tinNo, fatherName, arms, thigh, waistInch, hipInch, shoulder, doctorName, doctorContact, notifyPhone, notifyEmail, notifySMS, packages`.
Update `EXTRA_KEYS` to exactly that list (drops `maritalStatus`, `timeSlot`).

### C5. Optional one-time SQL backfill

```sql
update public.members
set marital_status = (extras->>'maritalStatus')::marital_enum
where marital_status is null and extras ? 'maritalStatus';

update public.members
set member_preferences = coalesce(
  array(select jsonb_array_elements_text(preferences->'preferences')),
  member_preferences
)
where member_preferences = '{}'::text[]
  and preferences ? 'preferences';
```

---

## PART D — Verification checklist after each part

After A: open Bookings, Add-Booking dialog, Package modal, POS, GRC print, Attendance, General Setup → no "Time Slot" field anywhere; no console errors.  
After B: create a booking, edit it, drag-reschedule it, cancel it — open the row in Supabase and confirm `start_time`, `end_time`, `service_type`, `class_name`, `instructor`, `rate`, `discount_amount`, `booking_status`, `cancel_reason`, `cancelled_at` are all populated correctly.  
After C: create a member, edit, view in MemberGRC and MemberProfile — confirm `member_code`, `marital_status`, `plan_id`, `member_preferences` are all writing to columns (not `extras`) in Supabase.



---

## Things you may need to fix manually if they break

- **Reports / Forecast** components that group bookings by `serviceType` or read `b.className` from `notes` JSON — after B2 these read directly from columns, so any place still parsing `JSON.parse(b.notes)` needs to be deleted.
- **BookingDetailModal** — if it shows instructor/class via `notes`, update to read from the new flat fields.
- **No-overlap EXCLUDE constraint** — once B3/B4 always write `start_time`/`end_time`, you may see DB rejection "conflicting key value" for overlapping confirmed bookings at the same outlet. That is the schema enforcing your business rule; surface it to the user as "slot already booked".
- **Setup table** — manually delete the row `category='setup_timeSlots'` from your `settings` table.
- **Legacy `members.extras.timeSlot` / `maritalStatus**` values — run the optional SQL in A9 / C5.