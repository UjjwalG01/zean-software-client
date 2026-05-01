# VitaFit Club — Cloud Functions

Two functions:

| Function              | Type      | Purpose                                              |
| --------------------- | --------- | ---------------------------------------------------- |
| `sendEmail`           | HTTPS     | POST `{to, subject, html|text}` → Resend via gateway |
| `scheduledReminders`  | Scheduled | Daily 08:00 Asia/Kathmandu — queues expiry & due-payment reminders into `emailReminders` |

## One-time setup

```bash
cd functions && npm install
firebase functions:secrets:set LOVABLE_API_KEY
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set REMINDER_FROM_EMAIL    # e.g. "VitaFit <noreply@yourdomain.com>"
firebase deploy --only functions
```

After deploy, copy the `sendEmail` URL and save it into Firestore:

```
companySettings/resendEndpoint = "https://<region>-<project>.cloudfunctions.net/sendEmail"
```

## Data migration — backfill `serviceType` on existing payments

Run once in the Firebase console (or as a one-off script):

```js
const snap = await db.collection("payments").get();
const batch = db.batch();
snap.docs.forEach((d) => {
  const desc = (d.data().description || "").toLowerCase();
  let serviceType = "Gym";
  if (desc.includes("spa")) serviceType = "Spa";
  else if (desc.includes("sauna")) serviceType = "Sauna";
  else if (desc.includes("swim")) serviceType = "Swimming";
  batch.update(d.ref, { serviceType });
});
await batch.commit();
```

## Deploying rules

```bash
firebase deploy --only firestore:rules
```
