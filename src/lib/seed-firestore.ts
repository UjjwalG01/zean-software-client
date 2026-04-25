/**
 * One-time seed script to populate Firestore with mock data.
 * Call `seedFirestore()` from browser console or a dev button.
 */
import { collection, doc, setDoc, Timestamp } from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { members, bookings, transactions } from "./mock-data";

export async function seedFirestore() {
  const db = getFirestoreDb();
  console.log("🌱 Seeding Firestore...");

  // Seed roles
  const roles = [
    { id: "role-admin", name: "admin", description: "Full system access" },
    { id: "role-moderator", name: "moderator", description: "Manage members and bookings" },
    { id: "role-user", name: "user", description: "Basic access" },
  ];
  for (const role of roles) {
    await setDoc(doc(db, "roles", role.id), {
      name: role.name,
      description: role.description,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${roles.length} roles seeded`);

  // Seed membership types
  const membershipTypes = [
    { id: "mt-gym", name: "Gym", description: "Gym access" },
    { id: "mt-spa", name: "Spa", description: "Spa services" },
    { id: "mt-sauna", name: "Sauna", description: "Sauna access" },
    { id: "mt-swimming", name: "Swimming", description: "Swimming pool access" },
  ];
  for (const mt of membershipTypes) {
    await setDoc(doc(db, "membershipTypes", mt.id), {
      name: mt.name,
      description: mt.description,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${membershipTypes.length} membership types seeded`);

  // Seed services
  const services = [
    { id: "svc-1", name: "Morning Power Yoga", type: "Gym", duration: 60, price: 500, isActive: true },
    { id: "svc-2", name: "HIIT Blast", type: "Gym", duration: 45, price: 600, isActive: true },
    { id: "svc-3", name: "Deep Tissue Massage", type: "Spa", duration: 90, price: 2500, isActive: true },
    { id: "svc-4", name: "Aromatherapy", type: "Spa", duration: 60, price: 2000, isActive: true },
    { id: "svc-5", name: "Sauna Session", type: "Sauna", duration: 30, price: 500, isActive: true },
    { id: "svc-6", name: "Infrared Sauna", type: "Sauna", duration: 45, price: 800, isActive: true },
    { id: "svc-7", name: "Lap Swimming", type: "Swimming", duration: 60, price: 400, isActive: true },
    { id: "svc-8", name: "Aqua Fitness", type: "Swimming", duration: 45, price: 600, isActive: true },
  ];
  for (const svc of services) {
    await setDoc(doc(db, "services", svc.id), {
      ...svc,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${services.length} services seeded`);

  // Seed membership plans
  const membershipPlans = [
    { id: "plan-basic", name: "Basic", tier: "Basic", price: 3000, yearlyPrice: 30000, longTermPrice: 350000, includes: "Gym Only", autoRenew: true, durationInMonths: 1 },
    { id: "plan-silver", name: "Silver", tier: "Silver", price: 5000, yearlyPrice: 50000, longTermPrice: 550000, includes: "Gym + Swimming", autoRenew: true, durationInMonths: 1 },
    { id: "plan-gold", name: "Gold", tier: "Gold", price: 8000, yearlyPrice: 80000, longTermPrice: 850000, includes: "Gym + Spa + Sauna", autoRenew: false, durationInMonths: 1 },
    { id: "plan-platinum", name: "Platinum", tier: "Platinum", price: 12000, yearlyPrice: 120000, longTermPrice: 1200000, includes: "Full Access + Personal Trainer", autoRenew: false, durationInMonths: 1 },
  ];
  for (const plan of membershipPlans) {
    await setDoc(doc(db, "membershipPlans", plan.id), {
      ...plan,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${membershipPlans.length} membership plans seeded`);

  // Seed members
  for (const m of members) {
    await setDoc(doc(db, "members", m.id), {
      firstName: m.name.split(" ")[0],
      lastName: m.name.split(" ").slice(1).join(" "),
      email: m.email,
      phone: m.phone,
      avatar: m.avatar,
      tier: m.tier,
      services: m.services,
      status: m.status,
      plan: m.plan,
      address: m.address,
      emergencyContactNum: m.emergencyContact,
      joiningDate: m.joinDate,
      expiryDate: m.expiryDate,
      preferences: m.preferences.join(", "),
      openingBalance: m.openingBalance,
      totalPaid: m.totalPaid,
      dueAmount: m.dueAmount,
      loyaltyYears: m.membershipYears,
      discount: m.discount,
      autoRenew: m.autoRenew,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${members.length} members seeded`);

  // Seed bookings
  for (const b of bookings) {
    await setDoc(doc(db, "bookings", b.id), {
      memberId: b.memberId,
      memberName: b.memberName,
      service: b.service,
      className: b.className,
      bookingDate: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      instructor: b.instructor,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${bookings.length} bookings seeded`);

  // Seed transactions as payments
  for (const t of transactions) {
    await setDoc(doc(db, "payments", t.id), {
      memberId: t.memberId,
      memberName: t.memberName,
      amount: t.amount,
      vatAmount: t.vat,
      totalAmount: t.total,
      paymentMethod: t.method,
      type: t.type,
      paymentDate: t.date,
      description: t.description,
      receiptNo: t.receiptNo,
      status: "Completed",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${transactions.length} transactions seeded`);

  // Seed company settings
  const companySettings = [
    { key: "companyName", value: "VitaFit Club", type: "string" },
    { key: "vatRate", value: "13", type: "number" },
    { key: "panNumber", value: "123456789", type: "string" },
    { key: "currency", value: "NPR", type: "string" },
    { key: "timezone", value: "Asia/Kathmandu", type: "string" },
    { key: "companyEmail", value: "info@vitafitclub.com", type: "string" },
    { key: "companyPhone", value: "+977-01-4567890", type: "string" },
    { key: "companyAddress", value: "Thamel, Kathmandu, Nepal", type: "string" },
  ];
  for (const s of companySettings) {
    await setDoc(doc(db, "companySettings", s.key), {
      ...s,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`✅ ${companySettings.length} company settings seeded`);

  console.log("🎉 Firestore seeding complete!");
}

// Make it available globally for console usage in development only
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).seedFirestore = seedFirestore;
}
