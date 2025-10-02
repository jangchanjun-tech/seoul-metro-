import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Vercel, these should be set as Environment Variables in the project settings.
// FIX: Changed from import.meta.env to process.env to resolve TypeScript errors. This assumes the build process is configured to expose these variables on process.env.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// A check to ensure Firebase is configured before use.
export const isFirebaseConfigured = !!firebaseConfig.projectId;

// Initialize Firebase
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Export Firebase services
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;