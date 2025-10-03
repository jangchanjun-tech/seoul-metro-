import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCe9aBbujNpgF4N3HOjgaxW1ILNME8T-9Y",
  authDomain: "seoulmetro-testing.firebaseapp.com",
  projectId: "seoulmetro-testing",
  storageBucket: "seoulmetro-testing.firebasestorage.app",
  messagingSenderId: "830081805649",
  appId: "1:830081805649:web:46da4ab18bf641d98cf770"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Set persistence to avoid errors in restricted environments
setPersistence(auth, browserSessionPersistence)
  .catch((error) => {
    console.error("Error setting auth persistence:", error);
  });

export { auth, db };
