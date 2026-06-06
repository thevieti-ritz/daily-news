// ============================================
// AUTH.JS — Leaked Archives
// Handles: Sign Up, Sign In, Google, Logout
// ============================================

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---- Elements ----
const tabSignIn     = document.getElementById('tabSignIn');
const tabSignUp     = document.getElementById('tabSignUp');
const signInForm    = document.getElementById('signInForm');
const signUpForm    = document.getElementById('signUpForm');
const authMessage   = document.getElementById('authMessage');

// ---- Tab Switching ----
tabSignIn.addEventListener('click', () => {
  tabSignIn.classList.add('active');
  tabSignUp.classList.remove('active');
  signInForm.classList.remove('hidden');
  signUpForm.classList.add('hidden');
  clearMessage();
});

tabSignUp.addEventListener('click', () => {
  tabSignUp.classList.add('active');
  tabSignIn.classList.remove('active');
  signUpForm.classList.remove('hidden');
  signInForm.classList.add('hidden');
  clearMessage();
});

// ---- Show Message ----
function showMessage(text, type = 'error') {
  authMessage.textContent = text;
  authMessage.className = `auth-message ${type}`;
}
function clearMessage() {
  authMessage.textContent = '';
  authMessage.className = 'auth-message hidden';
}

// ---- Save user profile to Firestore ----
async function saveUserProfile(user, extraData = {}) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || extraData.name || 'Anonymous',
      username: extraData.username || user.email.split('@')[0],
      email: user.email,
      avatar: user.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.uid}`,
      joinedAt: serverTimestamp(),
      downloads: []
    });
  }
}

// ---- SIGN UP ----
document.getElementById('signUpBtn').addEventListener('click', async () => {
  const name     = document.getElementById('signUpName').value.trim();
  const email    = document.getElementById('signUpEmail').value.trim();
  const password = document.getElementById('signUpPassword').value;

  if (!name) return showMessage('Please enter your full name.');
  if (!email) return showMessage('Please enter your email.');
  if (password.length < 6) return showMessage('Password must be at least 6 characters.');

  try {
    showMessage('Creating your account...', 'success');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await saveUserProfile(result.user, { name });
    showMessage('Account created! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1500);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') showMessage('This email is already registered. Try signing in.');
    else showMessage(err.message);
  }
});

// ---- SIGN IN ----
document.getElementById('signInBtn').addEventListener('click', async () => {
  const email    = document.getElementById('signInEmail').value.trim();
  const password = document.getElementById('signInPassword').value;

  if (!email) return showMessage('Please enter your email.');
  if (!password) return showMessage('Please enter your password.');

  try {
    showMessage('Signing in...', 'success');
    await signInWithEmailAndPassword(auth, email, password);
    showMessage('Welcome back! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1500);
  } catch (err) {
    if (err.code === 'auth/user-not-found') showMessage('No account found with this email.');
    else if (err.code === 'auth/wrong-password') showMessage('Incorrect password. Try again.');
    else showMessage(err.message);
  }
});

// ---- GOOGLE SIGN IN / SIGN UP ----
const googleProvider = new GoogleAuthProvider();

async function googleAuth() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(result.user);
    showMessage('Signed in with Google! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1500);
  } catch (err) {
    showMessage(err.message);
  }
}

document.getElementById('googleSignInBtn').addEventListener('click', googleAuth);
document.getElementById('googleSignUpBtn').addEventListener('click', googleAuth);

// ---- FORGOT PASSWORD ----
document.getElementById('forgotPwLink').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signInEmail').value.trim();
  if (!email) return showMessage('Enter your email above first, then click Forgot Password.');
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage('Password reset email sent! Check your inbox.', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

// ---- REDIRECT IF ALREADY LOGGED IN ----
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = 'index.html';
});