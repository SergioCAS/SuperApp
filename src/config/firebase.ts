import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

function hasMissingConfig() {
  return Object.values(firebaseConfig).some((value) => !value);
}

if (hasMissingConfig()) {
  // Keep boot permissive while setting envs; auth/firestore checks happen in health screen.
  console.warn("Firebase config incompleta. Revisa mobile/.env");
}

export let auth!: Auth;
export let db!: Firestore;
export let firebaseBootError: string | null = null;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  const message = error instanceof Error ? error.message : "Error desconocido al iniciar Firebase";
  firebaseBootError = message;
  console.error("No se pudo iniciar Firebase:", message);
}
