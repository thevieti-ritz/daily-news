// ============================================
// MAIN.JS — Homepage Logic
// Loads videos from Firebase, handles search,
// category filtering, and user auth state
// ============================================

import { db, auth } from "./firebase.js";
import {
  collection, query, orderBy, limit,
  startAfter, getDocs, where, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ---- CONFIG ----
const PAGE_SIZE = 12;

// ---- STATE ----
let lastDoc = null;
let currentCategory = "all";
let currentSearch = "";
let isLoading = false;

// ---- DOM REFS ----
const videoGrid = document.getElementById("videoGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const sectionTitle = document.getElementById("sectionTitle");
const videoCount = document.getElementById("videoCount");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const categoryPills = document.querySelectorAll(".pill");
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const authLink = document.getElementById("authLink");
const userMenu = document.getElementById("userMenu");
const userAvatar = document.getElementById("userAvatar");
const userDisplayName = document.getElementById("userDisplayName");
const logoutBtn = document.getElementById("logoutBtn");

// ---- AUTH STATE ----
onAuthStateChanged(auth, (user) => {
  if (user) {
    authLink.classList.add("hidden");
    userMenu.classList.remove("hidden");
    userDisplayName.textContent = user.displayName || user.email.split("@")[0];
    userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.uid}`;
  } else {
    authLink.classList.remove("hidden");
    userMenu.classList.add("hidden");
  }
});

logoutBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  signOut(auth);
});

// ---- SIDEBAR TOGGLE ----
menuToggle?.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("hidden");
});
sidebarOverlay?.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.add("hidden");
});

// ---- CATEGORY PILLS ----
categoryPills.forEach(pill => {
  pill.addEventListener("click", () => {
    categoryPills.forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    currentCategory = pill.dataset.cat;
    currentSearch = "";
    searchInput.value = "";
    resetAndLoad();
  });
});

// Check URL for ?cat= param
const urlParams = new URLSearchParams(window.location.search);
const catParam = urlParams.get("cat");
if (catParam) {
  currentCategory = catParam;
  categoryPills.forEach(p => {
    p.classList.remove("active");
    if (p.dataset.cat === catParam) p.classList.add("active");
  });
}

// ---- SEARCH ----
searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

function doSearch() {
  const val = searchInput.value.trim().toLowerCase();
  if (!val) return;
  currentSearch = val;
  currentCategory = "all";
  categoryPills.forEach(p => p.classList.remove("active"));
  categoryPills[0]?.classList.add("active");
  sectionTitle.textContent = `Search: "${searchInput.value.trim()}"`;
  resetAndLoad();
}

// ---- LOAD VIDEOS ----
function resetAndLoad() {
  lastDoc = null;
  videoGrid.innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>Loading videos...</p></div>`;
  loadMoreBtn.classList.add("hidden");
  loadVideos();
}

async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  try {
    let q;
    const videosRef = collection(db, "videos");

    if (currentSearch) {
      // Client-side search on title field
      q = query(videosRef, orderBy("createdAt", "desc"), limit(100));
    } else if (currentCategory !== "all") {
      q = query(
        videosRef,
        where("category", "==", currentCategory),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE),
        ...(lastDoc ? [startAfter(lastDoc)] : [])
      );
    } else {
      q = query(
        videosRef,
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE),
        ...(lastDoc ? [startAfter(lastDoc)] : [])
      );
    }

    const snapshot = await getDocs(q);
    let docs = snapshot.docs;

    // Client-side search filter
    if (currentSearch) {
      docs = docs.filter(d => {
        const data = d.data();
        return (
          data.title?.toLowerCase().includes(currentSearch) ||
          data.description?.toLowerCase().includes(currentSearch) ||
          data.tags?.some(t => t.toLowerCase().includes(currentSearch))
        );
      });
    }

    // Clear loading state on first load
    if (!lastDoc) {
      videoGrid.innerHTML = "";
    }

    if (docs.length === 0 && !lastDoc) {
      videoGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-video-slash"></i>
          <h3>No videos found</h3>
          <p>${currentSearch ? `No results for "${currentSearch}"` : "No videos in this category yet."}</p>
        </div>`;
      videoCount.textContent = "";
      loadMoreBtn.classList.add("hidden");
      isLoading = false;
      return;
    }

    // Render cards
    docs.forEach(docSnap => {
      const video = { id: docSnap.id, ...docSnap.data() };
      videoGrid.appendChild(createVideoCard(video));
    });

    // Update section title
    if (!currentSearch && currentCategory === "all") {
      sectionTitle.textContent = "Latest Videos";
    } else if (!currentSearch) {
      sectionTitle.textContent = capitalize(currentCategory);
    }

    // Last doc for pagination
    if (!currentSearch && docs.length === PAGE_SIZE) {
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      loadMoreBtn.classList.remove("hidden");
    } else {
      loadMoreBtn.classList.add("hidden");
    }

    // Video count
    videoCount.textContent = `${videoGrid.querySelectorAll(".video-card").length} videos`;

  } catch (err) {
    console.error("Error loading videos:", err);
    videoGrid.innerHTML = `<div class="empty-state"><i class="fas fa-circle-exclamation"></i><h3>Error loading videos</h3><p>${err.message}</p></div>`;
  }

  isLoading = false;
}

// ---- CREATE VIDEO CARD ----
function createVideoCard(video) {
  const card = document.createElement("div");
  card.className = "video-card";

  const thumb = video.thumbnail || generateThumb(video.archiveId);
  const views = formatNumber(video.views || 0);
  const likes = formatNumber(video.likes || 0);
  const date = video.createdAt ? timeAgo(video.createdAt.toDate()) : "";

  card.innerHTML = `
    <div class="card-thumb">
      <img src="${thumb}" alt="${escapeHtml(video.title)}" loading="lazy"
           onerror="this.src='https://archive.org/services/img/${video.archiveId}'"/>
      <div class="play-overlay"><i class="fas fa-play-circle"></i></div>
      ${video.featured ? '<span class="card-badge">Featured</span>' : ''}
    </div>
    <div class="card-info">
      <h3>${escapeHtml(video.title)}</h3>
      <div class="card-meta">
        <span><i class="fas fa-eye"></i> ${views}</span>
        <span><i class="fas fa-thumbs-up"></i> ${likes}</span>
        <span>${date}</span>
        <span class="card-cat-badge">${video.category || "general"}</span>
      </div>
    </div>`;

  card.addEventListener("click", () => {
    window.location.href = `watch.html?v=${video.id}`;
  });

  return card;
}

// ---- LOAD MORE ----
loadMoreBtn?.addEventListener("click", loadVideos);

// ---- HELPERS ----
function generateThumb(archiveId) {
  return `https://archive.org/services/img/${archiveId}`;
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 2592000) return Math.floor(seconds / 86400) + "d ago";
  return date.toLocaleDateString();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ---- INIT ----
loadVideos();