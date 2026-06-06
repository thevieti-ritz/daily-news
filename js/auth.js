// ============================================
// AUTH.JS — Login & Signup Logic
// Handles email/password and Google sign-in
// ============================================

import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const googleProvider = new GoogleAuthProvider();

// ---- DOM REFS ----
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const authMessage = document.getElementById("authMessage");

const signInEmail = document.getElementById("signInEmail");
const signInPassword = document.getElementById("signInPassword");
const signInBtn = document.getElementById("signInBtn");
const googleSignInBtn = document.getElementById("googleSignInBtn");

const signUpName = document.getElementById("signUpName");
const signUpEmail = document.getElementById("signUpEmail");
const signUpPassword = document.getElementById("signUpPassword");
const signUpBtn = document.getElementById("signUpBtn");
const googleSignUpBtn = document.getElementById("googleSignUpBtn");

const forgotPwLink = document.getElementById("forgotPwLink");

// ---- REDIRECT IF ALREADY LOGGED IN ----
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Send back to where they came from, or home
    const redirect = new URLSearchParams(window.location.search).get("redirect") || "index.html";
    window.location.href = redirect;
  }
});

// ---- TAB SWITCHING ----
tabSignIn?.addEventListener("click", () => {
  tabSignIn.classList.add("active");
  tabSignUp.classList.remove("active");
  signInForm.classList.remove("hidden");
  signUpForm.classList.add("hidden");
  clearMessage();
});

tabSignUp?.addEventListener("click", () => {
  tabSignUp.classList.add("active");
  tabSignIn.classList.remove("active");
  signUpForm.classList.remove("hidden");
  signInForm.classList.add("hidden");
  clearMessage();
});

// ---- SIGN IN ----
signInBtn?.addEventListener("click", async () => {
  const email = signInEmail.value.trim();
  const password = signInPassword.value;

  if (!email || !password) {
    showMessage("Please fill in all fields.", "error");
    return;
  }

  signInBtn.disabled = true;
  signInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("Signed in! Redirecting...", "success");
  } catch (err) {
    showMessage(friendlyError(err.code), "error");
    signInBtn.disabled = false;
    signInBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
  }
});

// ---- SIGN UP ----
signUpBtn?.addEventListener("click", async () => {
  const name = signUpName.value.trim();
  const email = signUpEmail.value.trim();
  const password = signUpPassword.value;

  if (!name || !email || !password) {
    showMessage("Please fill in all fields.", "error");
    return;
  }
  if (password.length < 6) {
    showMessage("Password must be at least 6 characters.", "error");
    return;
  }

  signUpBtn.disabled = true;
  signUpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    showMessage("Account created! Redirecting...", "success");
  } catch (err) {
    showMessage(friendlyError(err.code), "error");
    signUpBtn.disabled = false;
    signUpBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
  }
});

// ---- GOOGLE SIGN IN ----
const handleGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    showMessage("Signed in! Redirecting...", "success");
  } catch (err) {
    showMessage(friendlyError(err.code), "error");
  }
};
googleSignInBtn?.addEventListener("click", handleGoogle);
googleSignUpBtn?.addEventListener("click", handleGoogle);

// ---- FORGOT PASSWORD ----
forgotPwLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = signInEmail.value.trim();
  if (!email) {
    showMessage("Enter your email address first, then click Forgot Password.", "error");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("Password reset email sent! Check your inbox.", "success");
  } catch (err) {
    showMessage(friendlyError(err.code), "error");
  }
});

// ---- HELPERS ----
function showMessage(msg, type) {
  authMessage.textContent = msg;
  authMessage.className = `auth-message ${type}`;
  authMessage.classList.remove("hidden");
}

function clearMessage() {
  authMessage.classList.add("hidden");
}

function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email": return "Invalid email address.";
    case "auth/user-not-found": return "No account found with this email.";
    case "auth/wrong-password": return "Incorrect password. Try again.";
    case "auth/email-already-in-use": return "This email is already registered. Sign in instead.";
    case "auth/weak-password": return "Password is too weak. Use at least 6 characters.";
    case "auth/too-many-requests": return "Too many attempts. Please wait and try again.";
    case "auth/popup-closed-by-user": return "Google sign-in was cancelled.";
    case "auth/invalid-credential": return "Incorrect email or password.";
    default: return "Something went wrong. Please try again.";
  }
}