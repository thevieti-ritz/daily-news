// ============================================
// MAIN.JS — Leaked Archives
// Optimized for mobile speed + sort/filter
// ============================================

import { db, auth } from "./firebase.js";
import {
  collection, query, orderBy, limit,
  startAfter, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ---- CONFIG ----
const PAGE_SIZE = 8;

// ---- STATE ----
let lastDoc       = null;
let currentSearch = "";
let isLoading     = false;
let searchTimer   = null;

// Active filters
let activeSort     = "newest";
let activeDate     = "all";
let activeDuration = "all";
let activeQuality  = "all";

// ---- DOM REFS ----
const videoGrid       = document.getElementById("videoGrid");
const loadMoreBtn     = document.getElementById("loadMoreBtn");
const sectionTitle    = document.getElementById("sectionTitle");
const videoCount      = document.getElementById("videoCount");
const searchInput     = document.getElementById("searchInput");
const searchBtn       = document.getElementById("searchBtn");
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

// ---- SIDEBAR ----
menuToggle?.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("hidden");
});
sidebarOverlay?.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.add("hidden");
});
document.querySelectorAll(".side-link, .side-link.sub").forEach(link => {
  link.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.add("hidden");
  });
});

// ---- FILTER PILLS SETUP ----
function setupPills(containerId, stateKey, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(".filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      container.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      // Update the right state variable
      if (stateKey === "sort")     activeSort     = pill.dataset.sort;
      if (stateKey === "date")     activeDate     = pill.dataset.date;
      if (stateKey === "duration") activeDuration = pill.dataset.duration;
      if (stateKey === "quality")  activeQuality  = pill.dataset.quality;
      callback();
    });
  });
}

setupPills("sortPills",     "sort",     resetAndLoad);
setupPills("datePills",     "date",     resetAndLoad);
setupPills("durationPills", "duration", resetAndLoad);
setupPills("qualityPills",  "quality",  resetAndLoad);

// ---- SEARCH ----
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const val = searchInput.value.trim();
    if (val.length >= 2) doSearch();
    else if (val.length === 0) {
      currentSearch = "";
      sectionTitle.textContent = "Latest Videos";
      resetAndLoad();
    }
  }, 400);
});
searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

function doSearch() {
  const val = searchInput.value.trim().toLowerCase();
  if (!val) return;
  currentSearch = val;
  sectionTitle.textContent = `Results: "${searchInput.value.trim()}"`;
  resetAndLoad();
}

// ---- SKELETON LOADING ----
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

// ---- DATE FILTER HELPER ----
function getDateCutoff(dateFilter) {
  const now = new Date();
  if (dateFilter === "day")   { now.setDate(now.getDate() - 1); return now; }
  if (dateFilter === "week")  { now.setDate(now.getDate() - 7); return now; }
  if (dateFilter === "month") { now.setMonth(now.getMonth() - 1); return now; }
  if (dateFilter === "year")  { now.setFullYear(now.getFullYear() - 1); return now; }
  return null;
}

// ---- LOAD VIDEOS ----
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  try {
    const videosRef = collection(db, "videos");
    let q;

    // Build Firestore query based on sort
    if (activeSort === "views") {
      q = query(videosRef, orderBy("views", "desc"), limit(currentSearch ? 60 : PAGE_SIZE), ...(lastDoc ? [startAfter(lastDoc)] : []));
    } else if (activeSort === "rating") {
      q = query(videosRef, orderBy("likes", "desc"), limit(currentSearch ? 60 : PAGE_SIZE), ...(lastDoc ? [startAfter(lastDoc)] : []));
    } else if (activeSort === "length") {
      q = query(videosRef, orderBy("duration", "desc"), limit(currentSearch ? 60 : PAGE_SIZE), ...(lastDoc ? [startAfter(lastDoc)] : []));
    } else {
      // newest + relevance both default to createdAt desc
      q = query(videosRef, orderBy("createdAt", "desc"), limit(currentSearch ? 60 : PAGE_SIZE), ...(lastDoc ? [startAfter(lastDoc)] : []));
    }

    const snapshot = await getDocs(q);
    let docs = snapshot.docs;

    // ---- CLIENT-SIDE FILTERS ----

    // Search filter
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

    // Date filter
    const cutoff = getDateCutoff(activeDate);
    if (cutoff) {
      docs = docs.filter(d => {
        const created = d.data().createdAt?.toDate();
        return created && created >= cutoff;
      });
    }

    // Duration filter (uses 'duration' field in seconds)
    if (activeDuration === "short") {
      docs = docs.filter(d => (d.data().duration || 0) < 180);
    } else if (activeDuration === "medium") {
      docs = docs.filter(d => {
        const dur = d.data().duration || 0;
        return dur >= 180 && dur < 600;
      });
    } else if (activeDuration === "long") {
      docs = docs.filter(d => (d.data().duration || 0) >= 600);
    }

    // Quality filter (uses 'quality' field like "1080p", "720p")
    if (activeQuality !== "all") {
      docs = docs.filter(d => d.data().quality === activeQuality);
    }

    // Relevance sort (client-side: sort by views + likes combined)
    if (activeSort === "relevance") {
      docs = docs.sort((a, b) => {
        const scoreA = (a.data().views || 0) + (a.data().likes || 0) * 2;
        const scoreB = (b.data().views || 0) + (b.data().likes || 0) * 2;
        return scoreB - scoreA;
      });
    }

    // Clear skeletons
    if (!lastDoc) videoGrid.innerHTML = "";

    if (docs.length === 0 && !lastDoc) {
      videoGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-video-slash"></i>
          <h3>No videos found</h3>
          <p>${currentSearch ? `No results for "${currentSearch}"` : "Try adjusting your filters."}</p>
        </div>`;
      videoCount.textContent = "";
      loadMoreBtn.classList.add("hidden");
      isLoading = false;
      return;
    }

    // Render using document fragment (fast)
    const fragment = document.createDocumentFragment();
    docs.forEach(docSnap => {
      const video = { id: docSnap.id, ...docSnap.data() };
      fragment.appendChild(createVideoCard(video));
    });
    videoGrid.appendChild(fragment);

    // Update title
    if (!currentSearch) {
      const sortLabels = { newest: "Latest Videos", relevance: "Most Relevant", views: "Most Viewed", rating: "Top Rated", length: "By Length" };
      sectionTitle.textContent = sortLabels[activeSort] || "Latest Videos";
    }

    // Pagination
    if (!currentSearch && docs.length === PAGE_SIZE) {
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      loadMoreBtn.classList.remove("hidden");
    } else {
      loadMoreBtn.classList.add("hidden");
    }

    videoCount.textContent = `${videoGrid.querySelectorAll(".video-card").length} videos`;
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

  const thumb    = video.thumbnail || `https://archive.org/services/img/${video.archiveId}`;
  const views    = formatNumber(video.views || 0);
  const likes    = formatNumber(video.likes || 0);
  const date     = video.createdAt ? timeAgo(video.createdAt.toDate()) : "";
  const duration = video.duration ? formatDuration(video.duration) : "";
  const quality  = video.quality ? `<span class="quality-badge">${video.quality}</span>` : "";

  card.innerHTML = `
    <div class="card-thumb">
      <img data-src="${thumb}"
           src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E"
           alt="${escapeHtml(video.title)}"
           class="lazy-img"
           onerror="this.src='https://archive.org/services/img/${video.archiveId}'"/>
      <div class="play-overlay"><i class="fas fa-play-circle"></i></div>
      ${video.featured ? '<span class="card-badge">Featured</span>' : ''}
      ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
      ${quality}
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
      }, { rootMargin: "100px" });
    }
    lazyImages.forEach(img => lazyObserver.observe(img));
  } else {
    lazyImages.forEach(img => { img.src = img.dataset.src; });
  }
}

// ---- INFINITE SCROLL ----
const scrollObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !loadMoreBtn.classList.contains("hidden")) {
    loadVideos();
  }
}, { rootMargin: "200px" });
scrollObserver.observe(loadMoreBtn);

loadMoreBtn?.addEventListener("click", loadVideos);

// ---- HELPERS ----
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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