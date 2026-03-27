import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCZieVmmzIrTO1y2bFJ3Owvzufrm_Pbjn4",
  authDomain: "gymcentral-qjnqn.firebaseapp.com",
  projectId: "gymcentral-qjnqn",
  storageBucket: "gymcentral-qjnqn.firebasestorage.app",
  messagingSenderId: "240334244555",
  appId: "1:240334244555:web:f36e6243c7e4d83523694e",
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
