// ============================================
// FIREBASE CONFIGURATION
// Daily News UG — Video Platform
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Your Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyC4U6MWTPKDQZ_oICtSLdfnFP3a-HFILb4",
  authDomain: "daily-news-a8c64.firebaseapp.com",
  projectId: "daily-news-a8c64",
  storageBucket: "daily-news-a8c64.firebasestorage.app",
  messagingSenderId: "75335342698",
  appId: "1:75335342698:web:3e65f3d773eca7730b4813"
};

// Start Firebase
const app = initializeApp(firebaseConfig);

// db = Firestore (stores video info, comments, likes)
// auth = Authentication (user login/signup)
export const db = getFirestore(app);
export const auth = getAuth(app);
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /videos/{videoId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.email == "dbernardinvestments@gmail.com";
      allow update: if request.auth != null &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['views', 'likes', 'likedBy']);

      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow delete: if request.auth != null &&
          (request.auth.uid == resource.data.userId ||
           request.auth.token.email == "dbernardinvestments@gmail.com");
      }
    }
  }
}