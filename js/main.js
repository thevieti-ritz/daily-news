// ============================================
// MAIN.JS — Leaked Archives
// Optimized for mobile speed
// ============================================

import { db, auth } from "./firebase.js";
import {
  collection, query, orderBy, limit,
  startAfter, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ---- CONFIG ----
const PAGE_SIZE = 8; // smaller = faster on mobile

// ---- STATE ----
let lastDoc = null;
let currentCategory = "all";
let currentSearch = "";
let isLoading = false;
let searchTimer = null;

// ---- DOM REFS ----
const videoGrid       = document.getElementById("videoGrid");
const loadMoreBtn     = document.getElementById("loadMoreBtn");
const sectionTitle    = document.getElementById("sectionTitle");
const videoCount      = document.getElementById("videoCount");
const searchInput     = document.getElementById("searchInput");
const searchBtn       = document.getElementById("searchBtn");
const categoryPills   = document.querySelectorAll(".pill");
const menuToggle      = document.getElementById("menuToggle");
const sidebar         = document.getElementById("sidebar");
const sidebarOverlay  = document.getElementById("sidebarOverlay");
const authLink        = document.getElementById("authLink");
const userMenu        = document.getElementById("userMenu");
const userAvatar      = document.getElementById("userAvatar");
const userDisplayName = document.getElementById("userDisplayName");
const logoutBtn       = document.getElementById("logoutBtn");

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

// Close sidebar when a link inside it is clicked (mobile)
document.querySelectorAll(".side-link, .side-link.sub").forEach(link => {
  link.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.add("hidden");
  });
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
// Debounced — waits for user to stop typing before searching
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const val = searchInput.value.trim();
    if (val.length >= 2) doSearch();
    else if (val.length === 0) {
      currentSearch = "";
      currentCategory = "all";
      categoryPills.forEach(p => p.classList.remove("active"));
      categoryPills[0]?.classList.add("active");
      sectionTitle.textContent = "Latest Videos";
      resetAndLoad();
    }
  }, 400); // wait 400ms after typing stops
});

searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

function doSearch() {
  const val = searchInput.value.trim().toLowerCase();
  if (!val) return;
  currentSearch = val;
  currentCategory = "all";
  categoryPills.forEach(p => p.classList.remove("active"));
  categoryPills[0]?.classList.add("active");
  sectionTitle.textContent = `Results: "${searchInput.value.trim()}"`;
  resetAndLoad();
}

// ---- SKELETON LOADING CARDS ----
function showSkeletons(count = 8) {
  videoGrid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    videoGrid.innerHTML += `
      <div class="skeleton-card">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-info">
          <div class="skeleton-line long"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>`;
  }
}

// ---- RESET & LOAD ----
function resetAndLoad() {
  lastDoc = null;
  loadMoreBtn.classList.add("hidden");
  showSkeletons(PAGE_SIZE);
  loadVideos();
}

// ---- LOAD VIDEOS ----
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  try {
    let q;
    const videosRef = collection(db, "videos");

    if (currentSearch) {
      q = query(videosRef, orderBy("createdAt", "desc"), limit(60));
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

    // Clear skeletons on first load
    if (!lastDoc) videoGrid.innerHTML = "";

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

    // Render cards using a fragment (faster than innerHTML loop)
    const fragment = document.createDocumentFragment();
    docs.forEach(docSnap => {
      const video = { id: docSnap.id, ...docSnap.data() };
      fragment.appendChild(createVideoCard(video));
    });
    videoGrid.appendChild(fragment);

    // Update title
    if (!currentSearch && currentCategory === "all") {
      sectionTitle.textContent = "Latest Videos";
    } else if (!currentSearch) {
      sectionTitle.textContent = capitalize(currentCategory);
    }

    // Pagination
    if (!currentSearch && docs.length === PAGE_SIZE) {
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      loadMoreBtn.classList.remove("hidden");
    } else {
      loadMoreBtn.classList.add("hidden");
    }

    // Video count
    videoCount.textContent = `${videoGrid.querySelectorAll(".video-card").length} videos`;

    // Lazy load images that are now in the DOM
    initLazyLoad();

  } catch (err) {
    console.error("Error loading videos:", err);
    videoGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-circle-exclamation"></i>
        <h3>Error loading videos</h3>
        <p>Please check your connection and refresh.</p>
      </div>`;
  }

  isLoading = false;
}

// ---- CREATE VIDEO CARD ----
function createVideoCard(video) {
  const card = document.createElement("div");
  card.className = "video-card";

  const thumb = video.thumbnail || `https://archive.org/services/img/${video.archiveId}`;
  const views = formatNumber(video.views || 0);
  const likes = formatNumber(video.likes || 0);
  const date  = video.createdAt ? timeAgo(video.createdAt.toDate()) : "";

  // Use data-src instead of src for lazy loading
  card.innerHTML = `
    <div class="card-thumb">
      <img data-src="${thumb}"
           src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E"
           alt="${escapeHtml(video.title)}"
           class="lazy-img"
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

// ---- LAZY IMAGE LOADING ----
// Images only load when they scroll into view — saves data on mobile
let lazyObserver = null;

function initLazyLoad() {
  const lazyImages = document.querySelectorAll("img.lazy-img");

  if ("IntersectionObserver" in window) {
    if (!lazyObserver) {
      lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove("lazy-img");
            lazyObserver.unobserve(img);
          }
        });
      }, { rootMargin: "100px" }); // start loading 100px before visible
    }
    lazyImages.forEach(img => lazyObserver.observe(img));
  } else {
    // Fallback for old browsers — just load them all
    lazyImages.forEach(img => { img.src = img.dataset.src; });
  }
}

// ---- INFINITE SCROLL (auto load more on mobile) ----
const scrollObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !loadMoreBtn.classList.contains("hidden")) {
    loadVideos();
  }
}, { rootMargin: "200px" });

scrollObserver.observe(loadMoreBtn);

// ---- LOAD MORE BUTTON (manual fallback) ----
loadMoreBtn?.addEventListener("click", loadVideos);

// ---- HELPERS ----
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