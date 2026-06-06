// ============================================
// MAIN.JS — Leaked Archives
// ============================================

import { db, auth } from "./firebase.js";
import {
  collection, query, orderBy, limit,
  startAfter, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================
// CONFIG & STATE
// ============================================
const PAGE_SIZE    = 8;
let lastDoc        = null;
let currentSearch  = "";
let isLoading      = false;
let searchTimer    = null;
let activeSort     = "newest";
let activeDate     = "all";
let activeDuration = "all";
let activeQuality  = "all";

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
// SIDEBAR & HAMBURGER
// ============================================
function openSidebar()  { sidebar.classList.add("open");    sidebarOverlay.classList.remove("hidden"); }
function closeSidebar() { sidebar.classList.remove("open"); sidebarOverlay.classList.add("hidden"); }

menuToggle.addEventListener("click", () => {
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
});
sidebarOverlay.addEventListener("click", closeSidebar);
document.querySelectorAll(".side-link").forEach(l => l.addEventListener("click", closeSidebar));

// Categories accordion
const catToggle = document.getElementById("categoriesToggle");
const catMenu   = document.getElementById("categoriesMenu");
const catArrow  = document.getElementById("categoriesArrow");
catToggle.addEventListener("click", () => {
  const open = catMenu.classList.toggle("open");
  catArrow.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
});

// ============================================
// AUTH
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
logoutBtn?.addEventListener("click", (e) => { e.preventDefault(); signOut(auth); });

// ============================================
// FILTER DROPDOWNS
// ============================================
function setupDropdown(btnId, menuId, labelId, dataKey, onSelect) {
  const btn   = document.getElementById(btnId);
  const menu  = document.getElementById(menuId);
  const label = document.getElementById(labelId);
  if (!btn || !menu) return;

  // Move menu to body so NO parent can clip it
  document.body.appendChild(menu);
  menu.style.position = "fixed";
  menu.style.zIndex   = "99999";

  // Open / close
  btn.addEventListener("click", (e) => {
    e.stopPropagation();

    // Close every other dropdown
    document.querySelectorAll(".filter-dropdown-menu").forEach(m => {
      if (m !== menu) m.classList.add("hidden");
    });

    // Calculate position fresh each click
    const rect      = btn.getBoundingClientRect();
    menu.style.top  = (rect.bottom + 4) + "px";
    menu.style.left = rect.left + "px";
    menu.style.minWidth = rect.width + "px";

    menu.classList.toggle("hidden");
  });

  // Option selected
  menu.querySelectorAll(".filter-option").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.querySelectorAll(".filter-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");

      const val  = opt.dataset[dataKey];
      const text = opt.textContent.trim();

      if (label) {
        label.textContent = dataKey === "sort" ? text : (val === "all" ? "" : `: ${text}`);
      }
      btn.classList.toggle("active-filter", val !== "all" && val !== "newest");

      onSelect(val);
      menu.classList.add("hidden");
      resetAndLoad();
    });
  });
}

// Close all dropdowns when clicking outside
document.addEventListener("click", () => {
  document.querySelectorAll(".filter-dropdown-menu").forEach(m => m.classList.add("hidden"));
});

// Wire up dropdowns
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
searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

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
  videoGrid.innerHTML = Array(count).fill(`
    <div class="skeleton-card">
      <div class="skeleton-thumb"></div>
      <div class="skeleton-info">
        <div class="skeleton-line long"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>`).join("");
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
// DATE CUTOFF HELPER
// ============================================
function getDateCutoff(f) {
  const d = new Date();
  if (f === "day")   { d.setDate(d.getDate() - 1);         return d; }
  if (f === "week")  { d.setDate(d.getDate() - 7);         return d; }
  if (f === "month") { d.setMonth(d.getMonth() - 1);       return d; }
  if (f === "year")  { d.setFullYear(d.getFullYear() - 1); return d; }
  return null;
}

// ============================================
// LOAD VIDEOS
// ============================================
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  try {
    const ref        = collection(db, "videos");
    const fetchLimit = currentSearch ? 60 : PAGE_SIZE;
    const pagination = lastDoc ? [startAfter(lastDoc)] : [];

    const sortMap = {
      views:  ["views",     "desc"],
      rating: ["likes",     "desc"],
      length: ["duration",  "desc"],
    };
    const [sortField, sortDir] = sortMap[activeSort] || ["createdAt", "desc"];
    const q = query(ref, orderBy(sortField, sortDir), limit(fetchLimit), ...pagination);

    const snapshot = await getDocs(q);
    let docs = snapshot.docs;

    // Search filter
    if (currentSearch) {
      docs = docs.filter(d => {
        const v = d.data();
        return v.title?.toLowerCase().includes(currentSearch)
            || v.description?.toLowerCase().includes(currentSearch)
            || v.tags?.some(t => t.toLowerCase().includes(currentSearch));
      });
    }

    // Date filter
    const cutoff = getDateCutoff(activeDate);
    if (cutoff) {
      docs = docs.filter(d => {
        const t = d.data().createdAt?.toDate();
        return t && t >= cutoff;
      });
    }

    // Duration filter
    if (activeDuration === "short")  docs = docs.filter(d => (d.data().duration || 0) < 180);
    if (activeDuration === "medium") docs = docs.filter(d => { const s = d.data().duration || 0; return s >= 180 && s < 600; });
    if (activeDuration === "long")   docs = docs.filter(d => (d.data().duration || 0) >= 600);

    // Quality filter
    if (activeQuality !== "all") docs = docs.filter(d => d.data().quality === activeQuality);

    // Relevance sort (client-side)
    if (activeSort === "relevance") {
      docs.sort((a, b) => {
        const score = d => (d.data().views || 0) + (d.data().likes || 0) * 2;
        return score(b) - score(a);
      });
    }

    // Clear on first page
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

    // Render
    const frag = document.createDocumentFragment();
    docs.forEach(d => frag.appendChild(createVideoCard({ id: d.id, ...d.data() })));
    videoGrid.appendChild(frag);

    // Section title
    if (!currentSearch) {
      const titles = { newest: "Latest Videos", relevance: "Most Relevant", views: "Most Viewed", rating: "Top Rated", length: "By Length" };
      sectionTitle.textContent = titles[activeSort] || "Latest Videos";
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
    console.error(err);
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
// VIDEO CARD
// ============================================
function createVideoCard(video) {
  const card  = document.createElement("div");
  card.className = "video-card";

  const thumb    = video.thumbnail || `https://archive.org/services/img/${video.archiveId}`;
  const views    = formatNum(video.views    || 0);
  const likes    = formatNum(video.likes    || 0);
  const date     = video.createdAt ? timeAgo(video.createdAt.toDate()) : "";
  const duration = video.duration  ? formatDur(video.duration) : "";

  card.innerHTML = `
    <div class="card-thumb">
      <img data-src="${thumb}"
           src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E"
           alt="${esc(video.title)}" class="lazy-img"
           onerror="this.src='https://archive.org/services/img/${video.archiveId}'"/>
      <div class="play-overlay"><i class="fas fa-play-circle"></i></div>
      ${video.featured ? '<span class="card-badge">Featured</span>' : ""}
      ${duration       ? `<span class="duration-badge">${duration}</span>` : ""}
      ${video.quality  ? `<span class="quality-badge">${video.quality}</span>` : ""}
    </div>
    <div class="card-info">
      <h3>${esc(video.title)}</h3>
      <div class="card-meta">
        <span><i class="fas fa-eye"></i> ${views}</span>
        <span><i class="fas fa-thumbs-up"></i> ${likes}</span>
        <span>${date}</span>
        <span class="card-cat-badge">${video.category || "general"}</span>
      </div>
    </div>`;

  card.addEventListener("click", () => { window.location.href = `watch.html?v=${video.id}`; });
  return card;
}

// ============================================
// LAZY LOADING
// ============================================
let lazyObserver = null;
function initLazyLoad() {
  const imgs = document.querySelectorAll("img.lazy-img");
  if ("IntersectionObserver" in window) {
    if (!lazyObserver) {
      lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.src = e.target.dataset.src;
            e.target.classList.remove("lazy-img");
            lazyObserver.unobserve(e.target);
          }
        });
      }, { rootMargin: "100px" });
    }
    imgs.forEach(img => lazyObserver.observe(img));
  } else {
    imgs.forEach(img => { img.src = img.dataset.src; });
  }
}

// ============================================
// INFINITE SCROLL
// ============================================
new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !loadMoreBtn.classList.contains("hidden")) loadVideos();
}, { rootMargin: "200px" }).observe(loadMoreBtn);

loadMoreBtn?.addEventListener("click", loadVideos);

// ============================================
// HELPERS
// ============================================
function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function formatDur(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function timeAgo(date) {
  const s = Math.floor((new Date() - date) / 1000);
  if (s < 60)      return "Just now";
  if (s < 3600)    return Math.floor(s / 60) + "m ago";
  if (s < 86400)   return Math.floor(s / 3600) + "h ago";
  if (s < 2592000) return Math.floor(s / 86400) + "d ago";
  return date.toLocaleDateString();
}
function esc(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ============================================
// INIT
// ============================================
loadVideos();