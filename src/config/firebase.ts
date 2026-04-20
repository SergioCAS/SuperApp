import { getApp, getApps, initializeApp } from "firebase/app";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAuth,
  initializeAuth,
  type Auth
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { Platform } from "react-native";
// Firebase web API keys are public by design (visible in google-services.json,
// browser source, etc.). Security is enforced by Firebase security rules.
const firebaseConfig = {
  apiKey: "AIzaSyADonjEPtp1FJqq0ASPKRGKwE1EsqfYEYs",
  authDomain: "lista-del-super-f9bcd.firebaseapp.com",
  projectId: "lista-del-super-f9bcd",
  storageBucket: "lista-del-super-f9bcd.firebasestorage.app",
  messagingSenderId: "17569539196",
  appId: "1:17569539196:web:da1a3bfe5d37ecf55b55f9"
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
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  if (Platform.OS === "web") {
    auth = getAuth(app);
  } else {
    try {
      auth = initializeAuth(app, {
        persistence: require("@firebase/auth").getReactNativePersistence(
          ReactNativeAsyncStorage
        )
      });
    } catch (error) {
      const isAlreadyInitialized =
        error instanceof Error && error.message.includes("auth/already-initialized");
      if (!isAlreadyInitialized) {
        throw error;
      }
      auth = getAuth(app);
    }
  }
  db = getFirestore(app);
} catch (error) {
  const message = error instanceof Error ? error.message : "Error desconocido al iniciar Firebase";
  firebaseBootError = message;
  console.error("No se pudo iniciar Firebase:", message);
}
