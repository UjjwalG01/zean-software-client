import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  Timestamp, query, where,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

export type UserRole = "admin" | "manager" | "staff" | "viewer";

export interface AppUser {
  id: string;
  uid?: string;          // Firebase Auth UID (set after first login if known)
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt?: string;
  createdBy?: string;
}

const COLL = "appUsers";

export async function getAppUsers(): Promise<AppUser[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, COLL));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid: data.uid || "",
      username: data.username || "",
      email: data.email || "",
      fullName: data.fullName || "",
      phone: data.phone || "",
      address: data.address || "",
      role: (data.role || "staff") as UserRole,
      isActive: data.isActive !== false,
      mustChangePassword: data.mustChangePassword !== false,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
      createdBy: data.createdBy || "",
    };
  });
}

export async function getAppUserByEmail(email: string): Promise<AppUser | null> {
  const db = getFirestoreDb();
  const q = query(collection(db, COLL), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    uid: data.uid || "",
    username: data.username || "",
    email: data.email || "",
    fullName: data.fullName || "",
    phone: data.phone || "",
    address: data.address || "",
    role: (data.role || "staff") as UserRole,
    isActive: data.isActive !== false,
    mustChangePassword: data.mustChangePassword !== false,
  };
}

export async function createAppUserRecord(data: Omit<AppUser, "id" | "createdAt">): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, COLL), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateAppUser(id: string, data: Partial<AppUser>): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLL, id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteAppUser(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLL, id));
}

export async function clearMustChangePassword(email: string): Promise<void> {
  const user = await getAppUserByEmail(email);
  if (user) await updateAppUser(user.id, { mustChangePassword: false });
}
