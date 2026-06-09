// Firebase client SDK — initialized once, imported everywhere.
// Keys are intentionally client-side (Firebase design); security enforced
// via Firestore/Storage Security Rules, not key secrecy.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBDcyTvzmI8q9b58vt3mOdwZzlLpjCobBo",
  authDomain: "lore-10132.firebaseapp.com",
  projectId: "lore-10132",
  storageBucket: "lore-10132.firebasestorage.app",
  messagingSenderId: "331040043777",
  appId: "1:331040043777:web:333f08ca48416bbaec6100",
};

// Guard against duplicate init in dev hot-reload.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export default app;
