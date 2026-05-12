import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, Timestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestoreDb } from "./firebase";
import { storage } from "./firebase";

// ─── Service Types ──────────────────────────────────────────────────
export interface ServiceTypeDoc {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  defaultImage?: string;
  active: boolean;
}

export const DEFAULT_SERVICE_TYPES: Omit<ServiceTypeDoc, "id">[] = [
  { name: "Fitness",    slug: "fitness",    color: "hsl(38,92%,50%)",  icon: "dumbbell",   active: true,
    defaultImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop" },
  { name: "Wellness",   slug: "wellness",   color: "hsl(280,60%,55%)", icon: "sparkles",   active: true,
    defaultImage: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop" },
  { name: "Sports",     slug: "sports",     color: "hsl(200,80%,50%)", icon: "trophy",     active: true,
    defaultImage: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&auto=format&fit=crop" },
  { name: "Membership", slug: "membership", color: "hsl(45,93%,55%)",  icon: "crown",      active: true,
    defaultImage: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop" },
  { name: "Health",     slug: "health",     color: "hsl(142,71%,45%)", icon: "heart-pulse",active: true,
    defaultImage: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&auto=format&fit=crop" },
  { name: "Events",     slug: "events",     color: "hsl(15,80%,55%)",  icon: "calendar",   active: true,
    defaultImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop" },
];

const STC = "serviceTypes";

export async function getServiceTypes(): Promise<ServiceTypeDoc[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, STC));
  if (snap.empty) return [];
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function seedDefaultServiceTypes(): Promise<void> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, STC));
  if (!snap.empty) return;
  await Promise.all(
    DEFAULT_SERVICE_TYPES.map((t) =>
      setDoc(doc(db, STC, t.slug), { ...t, createdAt: Timestamp.now() })
    )
  );
}

export async function addServiceType(data: Partial<ServiceTypeDoc>): Promise<string> {
  const db = getFirestoreDb();
  const slug = (data.slug || data.name || "").toLowerCase().replace(/\s+/g, "-");
  await setDoc(doc(db, STC, slug), {
    name: data.name || slug,
    slug,
    color: data.color || "hsl(38,92%,50%)",
    icon: data.icon || "dot",
    defaultImage: data.defaultImage || "",
    active: data.active !== false,
    createdAt: Timestamp.now(),
  });
  return slug;
}

export async function updateServiceType(id: string, data: Partial<ServiceTypeDoc>): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, STC, id), { ...data, updatedAt: Timestamp.now() } as any);
}

export async function deleteServiceType(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, STC, id));
}

// ─── Outlets ────────────────────────────────────────────────────────
export interface Outlet {
  id: string;
  name: string;
  description?: string;
  serviceTypes: string[];   // serviceType slugs
  imageUrl?: string;
  color?: string;
  address?: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt?: string;
}

const OC = "outlets";

export async function getOutlets(): Promise<Outlet[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, OC));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.name || "",
      description: data.description || "",
      serviceTypes: Array.isArray(data.serviceTypes) ? data.serviceTypes : [],
      imageUrl: data.imageUrl || "",
      color: data.color || "hsl(38,92%,50%)",
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      active: data.active !== false,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
    };
  });
}

export async function addOutlet(data: Partial<Outlet>): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, OC), {
    name: data.name || "",
    description: data.description || "",
    serviceTypes: data.serviceTypes || [],
    imageUrl: data.imageUrl || "",
    color: data.color || "hsl(38,92%,50%)",
    address: data.address || "",
    phone: data.phone || "",
    email: data.email || "",
    active: data.active !== false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateOutlet(id: string, data: Partial<Outlet>): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, OC, id), { ...data, updatedAt: Timestamp.now() } as any);
}

export async function deleteOutlet(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, OC, id));
}

export async function uploadOutletImage(outletKey: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const r = storageRef(storage, `outlets/${outletKey}/cover.${ext}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}
