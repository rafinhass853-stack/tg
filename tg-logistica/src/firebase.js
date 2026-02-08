// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// (Opcional) Analytics
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyArq6_LiILL62v_3g2VIKcc4Z4MoWOK5k8",
  authDomain: "tg-logistica-a1389.firebaseapp.com",
  projectId: "tg-logistica-a1389",
  storageBucket: "tg-logistica-a1389.firebasestorage.app",
  messagingSenderId: "1021485083882",
  appId: "1:1021485083882:web:f9279533eb5baa45ae7b93",
  measurementId: "G-6RCVP747L3",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Analytics (opcional, não quebra se não suportar)
export let analytics = null;
(async () => {
  try {
    const ok = await isSupported();
    if (ok) analytics = getAnalytics(app);
  } catch (e) {
    analytics = null;
  }
})();
