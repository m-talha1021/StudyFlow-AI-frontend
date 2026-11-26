import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Required Firebase configuration (env var name per config key).
// Unlike before, a missing value must NEVER throw here: a throw at import
// time blanked the whole page for every visitor. Instead we record which
// env vars are missing and main.jsx renders a "Setup needed" screen.
const requiredConfig = [
  { key: "apiKey", envVar: "VITE_FIREBASE_API_KEY" },
  { key: "authDomain", envVar: "VITE_FIREBASE_AUTH_DOMAIN" },
  { key: "projectId", envVar: "VITE_FIREBASE_PROJECT_ID" },
  { key: "appId", envVar: "VITE_FIREBASE_APP_ID" },
];

export const missingFirebaseConfig = requiredConfig
  .filter(({ key }) => !firebaseConfig[key])
  .map(({ envVar }) => envVar);

export const firebaseConfigError =
  missingFirebaseConfig.length > 0
    ? `Missing Firebase configuration: ${missingFirebaseConfig.join(", ")}. ` +
      "Set the VITE_FIREBASE_* environment variables in Vercel and redeploy."
    : null;

// Prevent duplicate initialization during hot reload.
// When config is missing, `app` stays null and auth/db are null too;
// main.jsx gates on firebaseConfigError so the app never mounts in
// that state.
const app =
  missingFirebaseConfig.length > 0
    ? null
    : getApps().length
      ? getApp()
      : initializeApp(firebaseConfig);

// Firebase Authentication (null when Firebase is not configured)
export const auth = app ? getAuth(app) : null;

// Cloud Firestore (null when Firebase is not configured)
export const db = app ? getFirestore(app) : null;

// Export Firebase app (null when Firebase is not configured)
export default app;
