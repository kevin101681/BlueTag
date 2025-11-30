
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Helper to access env vars safely checking both Vite (import.meta.env) and standard process.env
const getEnv = (key: string) => {
  let value = "";
  
  // 1. Try import.meta.env (Vite)
  try {
    const meta = import.meta as any;
    if (meta && meta.env && meta.env[key]) {
      value = meta.env[key];
    }
  } catch (e) {}

  // 2. Try process.env (Fallback)
  if (!value) {
    try {
      if (typeof process !== 'undefined' && process.env && process.env[key]) {
        value = process.env[key];
      }
    } catch (e) {}
  }

  return value;
};

// Use environment variables if available, otherwise fall back to placeholders
const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY") || "AIzaSyCsCKeVfNtHk4lwT9vX262pVGHgW22TFAc",
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || "bluetag-34398.firebaseapp.com",
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID") || "bluetag-34398",
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET") || "bluetag-34398.firebasestorage.app",
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") || "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: getEnv("VITE_FIREBASE_APP_ID") || "REPLACE_WITH_YOUR_APP_ID"
};

// Initialize Firebase
// Note: initializeApp will not throw immediately on invalid config, but services will fail when used
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Auth Helpers
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    // Attempt login directly. The Firebase SDK will throw specific errors 
    // (e.g., auth/invalid-api-key) if configuration is incorrect.
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
    throw error;
  }
};
