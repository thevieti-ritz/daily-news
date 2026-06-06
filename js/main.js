// ============================================
// MAIN.JS — Leaked Archives
// Handles: sidebar, dropdowns, videos, search
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
let lastDoc        = null;
let currentSearch  = "";
let isLoading      = false;
let searchTimer    = null;
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

// ============================================
// SIDEBAR & HAMBURGER
// ============================================
menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("hidden");
});

sidebarOverlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.add("hidden");
});

// Close sidebar when a side link is clicked on mobile
document.querySelectorAll(".side-link").forEach(link => {
  link.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.add("hidden");
  });
});

// Categories accordion inside sidebar
const categoriesToggle = document.getElementById("categoriesToggle");
const categoriesMenu   = document.getElementById("categoriesMenu");
const categoriesArrow  = document.getElementById("categoriesArrow");

categoriesToggle.addEventListener("click", () => {
  const isOpen = categoriesMenu.classList.toggle("open");
  categoriesArrow.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
});

// ============================================
// AUTH STATE
// ============================================
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

// ============================================
// FILTER DROPDOWNS
// ============================================
function setupDropdown(btnId, menuId, labelId, dataKey, onSelect) {
  const btn  = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  const label = document.getElementById(labelId);
  if (!btn || !menu) return;

  // Open / close this dropdown
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Close all other dropdowns first
    document.querySelectorAll(".filter-dropdown-menu").forEach(m => {
      if (m !== menu) m.classList.add("hidden");
    });

    // Position the menu right below the button
    const rect = btn.getBoundingClientRect();
    menu.style.top  = (rect.bottom + 6) + "px";
    menu.style.left = rect.left + "px";

    menu.classList.toggle("hidden");
  });

  // When an option is picked
  menu.querySelectorAll(".filter-option").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();

      // Mark this option active
      menu.querySelectorAll(".filter-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");

      const val  = opt.dataset[dataKey];
      const text = opt.textContent.trim();

      // Update the button label
      if (label) {
        if (dataKey === "sort") {
          label.textContent = text;
        } else {
          label.textContent = (val === "all") ? "" : `: ${text}`;
        }
      }

      // Highlight button red if non-default filter active
      btn.classList.toggle("active-filter", val !== "all" && val !== "newest");

      // Update state
      onSelect(val);

      // Close menu then reload
      menu.classList.add("hidden");
      resetAndLoad();
    });
  });
}

// Close all dropdowns when clicking anywhere else on the page
document.addEventListener("click", () => {
  document.querySelectorAll(".filter-dropdown-menu").forEach(m => m.classList.add("hidden"));
});

// Wire up all four dropdowns
setupDropdown("sortBtn",     "sortMenu",     "sortLabel",     "sort",     (v) => { activeSort     = v; });
setupDropdown("dateBtn",     "dateMenu",     "dateLabel",     "date",     (v) => { activeDate     = v; });
setupDropdown("durationBtn", "durationMenu", "durationLabel", "duration", (v) => { activeDuration = v; });
setupDropdown("qualityBtn",  "qualityMenu",  "qualityLabel",  "quality",  (v) => { activeQuality  = v; });

// ============================================
// SEARCH
// ============================================
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const val = searchInput.value.trim();
    if (val.length >= 2) {
      doSearch();
    } else if (val.length === 0) {
      currentSearch = "";
      sectionTitle.textContent = "Latest Videos";
      resetAndLoad();
    }
  }, 400);
});

searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

function doSearch() {
  const val = searchInput.value.trim().toLowerCase();
  if (!val) return;
  currentSearch = val;
  sectionTitle.textContent = `Results: "${searchInput.value.trim()}"`;
  resetAndLoad();
}

// ============================================
// SKELETON LOADING
// ============================================
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

// ============================================
// RESET & LOAD
// ============================================
function resetAndLoad() {
  lastDoc = null;
  loadMoreBtn.classList.add("hidden");
  showSkeletons(PAGE_SIZE);
  loadVideos();
}

// ============================================
// DATE FILTER HELPER
// ============================================
function getDateCutoff(dateFilter) {
  const now = new Date();
  if (dateFilter === "day")   { now.setDate(now.getDate() - 1);         return now; }
  if (dateFilter === "week")  { now.setDate(now.getDate() - 7);         return now; }
  if (dateFilter === "month") { now.setMonth(now.getMonth() - 1);       return now; }
  if (dateFilter === "year")  { now.setFullYear(now.getFullYear() - 1); return now; }
  return null;
}

// ============================================
// LOAD VIDEOS FROM FIREBASE
// ============================================
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  try {
    const videosRef = collection(db, "videos");
    let q;
    const fetchLimit = currentSearch ? 60 : PAGE_SIZE;
    const pagination = lastDoc ? [startAfter(lastDoc)] : [];

    if (activeSort === "views") {
      q = query(videosRef, orderBy("views", "desc"),    limit(fetchLimit), ...pagination);
    } else if (activeSort === "rating") {
      q = query(videosRef, orderBy("likes", "desc"),    limit(fetchLimit), ...pagination);
    } else if (activeSort === "length") {
      q = query(videosRef, orderBy("duration", "desc"), limit(fetchLimit), ...pagination);
    } else {
      q = query(videosRef, orderBy("createdAt", "desc"), limit(fetchLimit), ...pagination);
    }

    const snapshot = await getDocs(q);
    let docs = snapshot.docs;

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

    // Duration filter
    if (activeDuration === "short") {
      docs = docs.filter(d => (d.data().duration || 0) < 180);
    } else if (activeDuration === "medium") {
      docs = docs.filter(d => { const dur = d.data().duration || 0; return dur >= 180 && dur < 600; });
    } else if (activeDuration === "long") {
      docs = docs.filter(d => (d.data().duration || 0) >= 600);
    }

    // Quality filter
    if (activeQuality !== "all") {
      docs = docs.filter(d => d.data().quality === activeQuality);
    }

    // Relevance sort (client-side score)
    if (activeSort === "relevance") {
      docs = docs.sort((a, b) => {
        const scoreA = (a.data().views || 0) + (a.data().likes || 0) * 2;
        const scoreB = (b.data().views || 0) + (b.data().likes || 0) * 2;
        return scoreB - scoreA;
      });
    }

    // Clear skeletons on first page
    if (!lastDoc) videoGrid.innerHTML = "";

    // Empty state
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

    // Render cards
    const fragment = document.createDocumentFragment();
    docs.forEach(docSnap => {
      fragment.appendChild(createVideoCard({ id: docSnap.id, ...docSnap.data() }));
    });
    videoGrid.appendChild(fragment);

    // Section title
    if (!currentSearch) {
      const labels = { newest: "Latest Videos", relevance: "Most Relevant", views: "Most Viewed", rating: "Top Rated", length: "By Length" };
      sectionTitle.textContent = labels[activeSort] || "Latest Videos";
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

// ============================================
// CREATE VIDEO CARD
// ============================================
function createVideoCard(video) {
  const card     = document.createElement("div");
  card.className = "video-card";

  const thumb    = video.thumbnail || `https://archive.org/services/img/${video.archiveId}`;
  const views    = formatNumber(video.views || 0);
  const likes    = formatNumber(video.likes || 0);
  const date     = video.createdAt ? timeAgo(video.createdAt.toDate()) : "";
  const duration = video.duration  ? formatDuration(video.duration) : "";
  const quality  = video.quality   ? `<span class="quality-badge">${video.quality}</span>` : "";

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

// ============================================
// LAZY IMAGE LOADING
// ============================================
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

// ============================================
// INFINITE SCROLL
// ============================================
const scrollObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !loadMoreBtn.classList.contains("hidden")) {
    loadVideos();
  }
}, { rootMargin: "200px" });

scrollObserver.observe(loadMoreBtn);
loadMoreBtn?.addEventListener("click", loadVideos);

// ============================================
// HELPERS
// ============================================
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60)      return "Just now";
  if (seconds < 3600)    return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400)   return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 2592000) return Math.floor(seconds / 86400) + "d ago";
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ============================================
// INIT
// ============================================
loadVideos();