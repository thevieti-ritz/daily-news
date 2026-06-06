// ============================================
// FIREBASE CONFIGURATION
// Leaked Archives
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4U6MWTPKDQZ_oICtSLdfnFP3a-HFILb4",
  authDomain: "daily-news-a8c64.firebaseapp.com",
  projectId: "daily-news-a8c64",
  storageBucket: "daily-news-a8c64.firebasestorage.app",
  messagingSenderId: "75335342698",
  appId: "1:75335342698:web:3e65f3d773eca7730b4813"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);