import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBZpZQ7D_t-rZmJ7PSdQnxelN4T9z_Br8Q",
  authDomain: "vitafitclub-v1.firebaseapp.com",
  projectId: "vitafitclub-v1",
  storageBucket: "vitafitclub-v1.firebasestorage.app",
  messagingSenderId: "455479727261",
  appId: "1:455479727261:web:051d6f7d3d2206081af074",
  measurementId: "G-PE3GJG7HT6",
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

export function getFirestoreDb(): Firestore {
  return db;
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function isConfigured(): boolean {
  return true;
}
