// FIX: Removed reference to vite/client to resolve 'Cannot find type definition file' error.
// Types for import.meta.env are now globally available from src/types.ts.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error("Firebase config environment variables are not set. Please add VITE_FIREBASE_* variables to your environment.");
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, browserSessionPersistence)
  .catch((error) => {
    console.error("Error setting auth persistence:", error);
  });

export { auth, db };