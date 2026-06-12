// ============================================
// MAIN.JS — Leaked Archives
// ============================================

import { db, auth } from "./firebase.js";
import {
  collection, query, orderBy, limit,
  startAfter, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================
// CONFIG & STATE
// ============================================
const PAGE_SIZE    = 12;
let lastDoc        = null;
let currentSearch  = "";
let isLoading      = false;
let searchTimer    = null;
let activeSort     = "newest";
let activeDate     = "all";
let activeDuration = "all";
let activeQuality  = "all";
let activeCategory = null;

// ============================================
// DOM REFS
// ============================================
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
// SIDEBAR
// ============================================
menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("hidden");
});
sidebarOverlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.add("hidden");
});
document.querySelectorAll(".side-link").forEach(link => {
  link.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.add("hidden");
  });
});
document.getElementById("categoriesToggle").addEventListener("click", () => {
  const menu  = document.getElementById("categoriesMenu");
  const arrow = document.getElementById("categoriesArrow");
  const isOpen = menu.classList.toggle("open");
  arrow.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
});

// ============================================
// AUTH
// ============================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    authLink.classList.add("hidden");
    userMenu.classList.remove("hidden");
    userDisplayName.textContent = user.displayName || user.email.split("@")[0];
    userAvatar.src = user.photoURL ||
      `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.uid}`;
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
  const btn   = document.getElementById(btnId);
  const menu  = document.getElementById(menuId);
  const label = document.getElementById(labelId);
  if (!btn || !menu) return;

  document.body.appendChild(menu);
  menu.style.position = "fixed";
  menu.style.zIndex   = "99999";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".filter-dropdown-menu").forEach(m => {
      if (m !== menu) m.classList.add("hidden");
    });
    const rect = btn.getBoundingClientRect();
    menu.style.top      = (rect.bottom + 4) + "px";
    menu.style.left     = rect.left + "px";
    menu.style.minWidth = Math.max(rect.width, 160) + "px";
    menu.classList.toggle("hidden");
  });

  menu.querySelectorAll(".filter-option").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.querySelectorAll(".filter-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      const val  = opt.dataset[dataKey];
      const text = opt.textContent.trim();
      if (label) {
        label.textContent = dataKey === "sort"
          ? text
          : (val === "all" ? "" : `: ${text}`);
      }
      btn.classList.toggle("active-filter", val !== "all" && val !== "newest");
      onSelect(val);
      menu.classList.add("hidden");
      resetAndLoad();
    });
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".filter-dropdown-menu").forEach(m => m.classList.add("hidden"));
});

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
      sectionTitle.textContent = activeCategory
        ? capitalize(activeCategory)
        : "Latest Videos";
      resetAndLoad();
    }
  }, 350);
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
// SKELETON CARDS
// ============================================
const skeletonHTML = Array(PAGE_SIZE).fill(`
  <div class="skeleton-card">
    <div class="skeleton-thumb"></div>
    <div class="skeleton-info">
      <div class="skeleton-line long"></div>
      <div class="skeleton-line short"></div>
    </div>
  </div>`).join("");

function showSkeletons() {
  videoGrid.innerHTML = skeletonHTML;
}

// ============================================
// RESET & LOAD — resets pagination and reloads
// ============================================
function resetAndLoad() {
  lastDoc = null;
  loadMoreBtn.classList.add("hidden");
  showSkeletons();
  loadVideos();
}

// ============================================
// DATE CUTOFF
// ============================================
function getDateCutoff(filter) {
  const now = new Date();
  if (filter === "day")   { now.setDate(now.getDate() - 1);         return now; }
  if (filter === "week")  { now.setDate(now.getDate() - 7);         return now; }
  if (filter === "month") { now.setMonth(now.getMonth() - 1);       return now; }
  if (filter === "year")  { now.setFullYear(now.getFullYear() - 1); return now; }
  return null;
}

// ============================================
// BUILD FIRESTORE QUERY
// ============================================
function buildQuery(fetchLimit) {
  const ref        = collection(db, "videos");
  const pagination = lastDoc ? [startAfter(lastDoc)] : [];

  if (activeCategory) {
    return query(
      ref,
      where("category", "==", activeCategory),
      orderBy("createdAt", "desc"),
      limit(fetchLimit),
      ...pagination
    );
  }

  const sortMap = {
    views:  ["views",    "desc"],
    rating: ["likes",    "desc"],
    length: ["duration", "desc"],
  };
  const [field, dir] = sortMap[activeSort] || ["createdAt", "desc"];
  return query(ref, orderBy(field, dir), limit(fetchLimit), ...pagination);
}

// ============================================
// LOAD VIDEOS — main fetch function
// ============================================
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  try {
    const fetchLimit = currentSearch ? 80 : PAGE_SIZE;
    const snapshot   = await getDocs(buildQuery(fetchLimit));
    let docs         = snapshot.docs;

    // Save last document for pagination BEFORE filtering
    const rawLastDoc = snapshot.docs[snapshot.docs.length - 1];

    // ---- Client-side filters ----

    // Search
    if (currentSearch) {
      docs = docs.filter(d => {
        const v = d.data();
        return (
          v.title?.toLowerCase().includes(currentSearch) ||
          v.description?.toLowerCase().includes(currentSearch) ||
          v.tags?.some(t => t.toLowerCase().includes(currentSearch))
        );
      });
    }

    // Date
    const cutoff = getDateCutoff(activeDate);
    if (cutoff) {
      docs = docs.filter(d => {
        const c = d.data().createdAt?.toDate();
        return c && c >= cutoff;
      });
    }

    // Duration
    if (activeDuration === "short") {
      docs = docs.filter(d => (d.data().duration || 0) < 180);
    } else if (activeDuration === "medium") {
      docs = docs.filter(d => {
        const s = d.data().duration || 0;
        return s >= 180 && s < 600;
      });
    } else if (activeDuration === "long") {
      docs = docs.filter(d => (d.data().duration || 0) >= 600);
    }

    // Quality
    if (activeQuality !== "all") {
      docs = docs.filter(d => d.data().quality === activeQuality);
    }

    // Relevance sort
    if (activeSort === "relevance") {
      docs = [...docs].sort((a, b) => {
        const sA = (a.data().views || 0) + (a.data().likes || 0) * 2;
        const sB = (b.data().views || 0) + (b.data().likes || 0) * 2;
        return sB - sA;
      });
    }

    // ---- Empty state ----
    if (docs.length === 0 && !lastDoc) {
      videoGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-video-slash"></i>
          <h3>No videos found</h3>
          <p>${currentSearch
            ? `No results for "${currentSearch}"`
            : "Try adjusting your filters."
          }</p>
        </div>`;
      videoCount.textContent = "";
      loadMoreBtn.classList.add("hidden");
      isLoading = false;
      return;
    }

    // ---- Clear grid only on first page ----
    if (!lastDoc) {
      videoGrid.innerHTML = "";
    }

    // ---- Render new cards (append, never replace) ----
    const fragment = document.createDocumentFragment();
    docs.forEach(d => {
      fragment.appendChild(createVideoCard({ id: d.id, ...d.data() }));
    });
    videoGrid.appendChild(fragment);

    // ---- Section title ----
    if (!currentSearch) {
      const labels = {
        newest:    "Latest Videos",
        relevance: "Most Relevant",
        views:     "Most Viewed",
        rating:    "Top Rated",
        length:    "By Length"
      };
      sectionTitle.textContent = activeCategory
        ? capitalize(activeCategory)
        : (labels[activeSort] || "Latest Videos");
    }

    // ---- Pagination ----
    // Update lastDoc only when we have a full page
    if (!currentSearch && snapshot.docs.length === PAGE_SIZE) {
      lastDoc = rawLastDoc;
      loadMoreBtn.classList.remove("hidden");
    } else {
      loadMoreBtn.classList.add("hidden");
    }

    // ---- Count ----
    const total = videoGrid.querySelectorAll(".video-card").length;
    videoCount.textContent = `${total} video${total !== 1 ? "s" : ""}`;

    // ---- Lazy load images ----
    initLazyLoad();

  } catch (err) {
    console.error("Load error:", err);
    videoGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-circle-exclamation"></i>
        <h3>Error loading videos</h3>
        <p>Check your connection and refresh.</p>
      </div>`;
  }

  isLoading = false;
}

// ============================================
// VIDEO CARD
// ============================================
function createVideoCard(video) {
  const card     = document.createElement("div");
  card.className = "video-card";

  const thumb    = video.thumbnail ||
    "https://via.placeholder.com/320x180/1a1a1a/e63946?text=Leaked+Archives";
  const views    = formatNumber(video.views || 0);
  const date     = video.createdAt ? timeAgo(video.createdAt.toDate()) : "";
  const duration = video.duration
    ? `<span class="duration-badge">${formatDuration(video.duration)}</span>`
    : "";
  const quality  = video.quality
    ? `<span class="quality-badge">${video.quality}</span>`
    : "";
  const featured = video.featured
    ? `<span class="card-badge">Featured</span>`
    : "";

  card.innerHTML = `
    <div class="card-thumb">
      <img data-src="${thumb}"
           src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E"
           alt="${escapeHtml(video.title)}"
           class="lazy-img"
           loading="lazy"
           decoding="async"
           onerror="this.src='https://via.placeholder.com/320x180/1a1a1a/e63946?text=Video'"/>
      <div class="play-overlay"><i class="fas fa-play-circle"></i></div>
      ${featured}${duration}${quality}
    </div>
    <div class="card-info">
      <h3>${escapeHtml(video.title)}</h3>
      <div class="card-meta">
        <span><i class="fas fa-eye"></i> ${views}</span>
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
const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.remove("lazy-img");
      lazyObserver.unobserve(img);
    }
  });
}, { rootMargin: "150px", threshold: 0 });

function initLazyLoad() {
  document.querySelectorAll("img.lazy-img").forEach(img => lazyObserver.observe(img));
}

// ============================================
// INFINITE SCROLL — auto load more
// ============================================
new IntersectionObserver((entries) => {
  if (
    entries[0].isIntersecting &&
    !loadMoreBtn.classList.contains("hidden") &&
    !isLoading
  ) {
    loadVideos();
  }
}, { rootMargin: "300px" }).observe(loadMoreBtn);

loadMoreBtn?.addEventListener("click", loadVideos);

// ============================================
// HELPERS
// ============================================
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "K";
  return n.toString();
}
function formatDuration(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
function timeAgo(date) {
  const s = Math.floor((new Date() - date) / 1000);
  if (s < 60)      return "Just now";
  if (s < 3600)    return Math.floor(s / 60) + "m ago";
  if (s < 86400)   return Math.floor(s / 3600) + "h ago";
  if (s < 2592000) return Math.floor(s / 86400) + "d ago";
  return date.toLocaleDateString();
}
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================
// INIT — read URL params on page load
// ============================================
const urlParams   = new URLSearchParams(window.location.search);
const catParam    = urlParams.get("cat");
const searchParam = urlParams.get("search");

if (searchParam) {
  searchInput.value        = searchParam;
  currentSearch            = searchParam.toLowerCase();
  sectionTitle.textContent = `Results: "${searchParam}"`;
  loadVideos();
} else if (catParam) {
  activeCategory           = catParam;
  sectionTitle.textContent = capitalize(catParam);
  loadVideos();
} else {
  loadVideos();
}