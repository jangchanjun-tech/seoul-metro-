// FIX: Added reference to "vite/client" to provide correct types for `import.meta.env`.
/// <reference types="vite/client" />

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
export let isFirebaseInitialized = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    
    setPersistence(auth, browserSessionPersistence)
      .catch((error) => {
        console.error("Error setting auth persistence:", error);
      });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    isFirebaseInitialized = false;
  }
} else {
    console.warn("Firebase config environment variables are not set. Firebase features will be disabled.");
}

export { auth, db };