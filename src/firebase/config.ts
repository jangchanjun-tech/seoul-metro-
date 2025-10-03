// FIX: Updated to use Firebase v8 namespaced imports to resolve module resolution errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// --- Firebase Configuration ---
// The configuration values have been set based on your provided screenshot.
const firebaseConfig = {
  apiKey: "AIzaSyCe9aBbujNpgF4N3HOjgaxW1ILNME8T-9Y",
  authDomain: "seoulmetro-testing.firebaseapp.com",
  projectId: "seoulmetro-testing",
  storageBucket: "seoulmetro-testing.firebasestorage.app",
  messagingSenderId: "830081805649",
  appId: "1:830081805649:web:46da4ab18bf641d98cf770"
};

// This simplified logic checks if the essential configuration (projectId) is present.
export const isFirebaseConfigured = !!firebaseConfig.projectId;

// FIX: Switched to v8 initialization pattern to avoid re-initializing the app on hot reloads.
let app: firebase.app.App | null = null;
if (isFirebaseConfigured) {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app();
    }
}

// FIX: Switched to Firebase v8 syntax for getting auth, firestore, and provider instances.
export const auth = app ? app.auth() : null;
export const db = app ? app.firestore() : null;
