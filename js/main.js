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
const R2_BASE      = "https://pub-947189f89d8c4deba38620dab133e00a.r2.dev/";
const AD_EVERY     = 1;   // one ad slot before every N video cards (1 = ad, video, ad, video...)
const AD_PER_SLOT  = 2;   // how many ads sit side by side inside one ad slot
const AD_WIDTH     = 200; // max width of EACH ad in px - keep equal to "Maximum Width" in the ExoClick zone
const AD_SLOT_SPAN = 2;   // how many grid columns wide an ad slot is (2 gives room for two 200px ads in a row)
let lastDoc        = null;
let currentSearch  = "";
let isLoading      = false;
let searchTimer    = null;
let activeSort     = "newest";
let activeDate     = "all";
let activeDuration = "all";
let activeQuality  = "all";
let activeCategory = null;
let videoCardCount = 0; // running total of rendered video cards (across pages), used for ad placement

// ============================================
// AD SLOT STYLES (self-contained)
// Ad slots are normal grid cells, same size as a video
// card, so the grid reads: ad, video, ad, video...
// Each slot holds AD_PER_SLOT ads in one horizontal row
// (like a chain), each capped at AD_WIDTH.
// On laptops/desktops the slot is AD_SLOT_SPAN grid columns
// wide so both fit. On phones it takes the full row.
// Rules use !important so the site stylesheet cannot override them.
// ============================================
(function addAdStyles() {
  const st = document.createElement("style");
  st.textContent = `
    /* base rules - !important so the site stylesheet cannot override them on laptops/desktops */
    #videoGrid > .ad-slot {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      box-sizing: border-box !important;
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
      min-height: 100px !important;
      height: auto !important;
      margin: 0 !important;
      padding: 8px !important;
      overflow: hidden !important;
      border-radius: 12px !important;
      background: rgba(127,127,127,.08) !important;
    }
    #videoGrid > .ad-slot .ad-outstream-wrapper {
      flex: 0 1 ${AD_WIDTH}px !important;
      width: ${AD_WIDTH}px !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }
    #videoGrid > .ad-slot ins {
      display: block !important;
      width: 100% !important;
      max-width: ${AD_WIDTH}px !important;
      margin: 0 auto !important;
    }

    /* laptops and desktops: slot spans several grid columns so both ads sit in one row */
    @media (min-width: 701px) {
      #videoGrid > .ad-slot {
        grid-column: span ${AD_SLOT_SPAN} !important;
        min-height: ${Math.round(AD_WIDTH * 9 / 16) + 32}px !important;
      }
    }

    /* phones: slot takes the full row */
    @media (max-width: 700px) {
      #videoGrid > .ad-slot { grid-column: 1 / -1 !important; }
    }
  `;
  document.head.appendChild(st);
})();

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
// RESET & LOAD
// ============================================
function resetAndLoad() {
  lastDoc = null;
  videoCardCount = 0; // restart ad-placement counter whenever the grid is rebuilt from scratch
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
// GET VIDEO URL
// ============================================
function getVideoUrl(archiveId) {
  if (!archiveId) return "";
  if (archiveId.startsWith("http")) return archiveId;
  return R2_BASE + archiveId;
}

// ============================================
// LOAD VIDEOS
// ============================================
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  try {
    const fetchLimit = currentSearch ? 80 : PAGE_SIZE;
    const snapshot   = await getDocs(buildQuery(fetchLimit));
    let docs         = snapshot.docs;
    const rawLastDoc = snapshot.docs[snapshot.docs.length - 1];

    // Hide videos still pending admin approval
    docs = docs.filter(d => d.data().status !== "pending");

    // Search filter
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

    // Date filter
    const cutoff = getDateCutoff(activeDate);
    if (cutoff) {
      docs = docs.filter(d => {
        const c = d.data().createdAt?.toDate();
        return c && c >= cutoff;
      });
    }

    // Duration filter
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

    // Quality filter
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

    // Empty state
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

    // Clear grid on first page only
    if (!lastDoc) videoGrid.innerHTML = "";

    // Render cards: an ad slot comes BEFORE every AD_EVERY-th card,
    // so the grid starts with an ad: ad, video, ad, video...
    const fragment = document.createDocumentFragment();
    const newAdSlots = [];
    docs.forEach(d => {
      if (videoCardCount % AD_EVERY === 0) {
        const slot = createAdSlot();
        fragment.appendChild(slot);
        // each ad inside the slot is queued separately
        slot.querySelectorAll(".ad-outstream-wrapper").forEach(u => newAdSlots.push(u));
      }
      fragment.appendChild(createVideoCard({ id: d.id, ...d.data() }));
      videoCardCount++;
    });
    videoGrid.appendChild(fragment);

    // Load the new ads one at a time (see AD SLOT section)
    newAdSlots.forEach(queueAd);

    // Section title
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

    // Pagination
    if (!currentSearch && snapshot.docs.length === PAGE_SIZE) {
      lastDoc = rawLastDoc;
      loadMoreBtn.classList.remove("hidden");
    } else {
      loadMoreBtn.classList.add("hidden");
    }

    const total = videoGrid.querySelectorAll(".video-card").length;
    videoCount.textContent = `${total} video${total !== 1 ? "s" : ""}`;

    // Init lazy load and auto thumbnails
    initLazyLoad();
    initVideoThumbnails();

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

  const videoUrl = getVideoUrl(video.archiveId);
  const hasThumbnail = !!video.thumbnail;
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

  // If thumbnail exists use lazy image
  // If no thumbnail use video element with #t=3 to show frame at 3 seconds
  const mediaHtml = hasThumbnail
    ? `<img
         data-src="${video.thumbnail}"
         src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E"
         alt="${escapeHtml(video.title)}"
         class="lazy-img card-thumb-img"
         loading="lazy"
         decoding="async"/>`
    : `<video
         class="card-thumb-video"
         data-src="${videoUrl}#t=3"
         preload="none"
         muted
         playsinline
         crossorigin="anonymous"
         style="width:100%;height:100%;object-fit:cover;display:block;">
       </video>`;

  card.innerHTML = `
    <div class="card-thumb">
      ${mediaHtml}
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
// AD SLOT
// Inserted into the video grid before every
// AD_EVERY-th video card. Single unit:
//   ExoClick outstream video (zone 5993834)
// ============================================
let adSlotCounter = 0;
let exoclickScriptLoaded = false;

function ensureExoclickScript() {
  if (exoclickScriptLoaded) return;
  exoclickScriptLoaded = true;
  window.AdProvider = window.AdProvider || [];
  // already loaded by another file or by index.html? then nothing to do
  if (window.__adLibLoaded) return;
  if (document.querySelector('script[src*="ad-provider.js"], script[src*="/js/sdk.js"]')) return;
  window.__adLibLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.type = "application/javascript";
  s.src = "/js/sdk.js";
  document.head.appendChild(s);
}

function createAdSlot() {
  adSlotCounter++;
  ensureExoclickScript();

  const wrap = document.createElement("div");
  wrap.className = "ad-slot";
  wrap.dataset.adSlot = adSlotCounter;

  // The ads themselves are added later by loadAd(), one at a time
  wrap.innerHTML = `<div class="ad-outstream-wrapper"></div>`.repeat(AD_PER_SLOT);

  return wrap;
}

// ---- Load ads one by one: first immediately, then one every 0.5s ----
const AD_GAP_MS  = 500;   // wait between each ad
const AD_BATCH   = 1;     // one ad per round
const AD_STAGGER = 500;   // ms between ads inside one round
const AD_DEBUG   = true;  // short "[ads]" messages in the browser console (set false when happy)
const adQueue = [];
let adQueueRunning = false;

function queueAd(wrap) {
  adQueue.push(wrap);
  if (adQueueRunning) return;
  adQueueRunning = true;
  (function next() {
    if (!adQueue.length) { adQueueRunning = false; return; }
    for (let i = 0; i < AD_BATCH && adQueue.length; i++) {
      const w = adQueue.shift();
      setTimeout(() => { if (document.body.contains(w)) loadAd(w); }, i * AD_STAGGER);
    }
    setTimeout(next, AD_GAP_MS);
  })();
}

function adLog(...args) { if (AD_DEBUG && window.console) console.log("[ads]", ...args); }
let adSlotNo = 0;

// Ask ONCE. No retries, no reloads, no freezing.
function loadAd(wrap) {
  if (wrap.__adShown || wrap.__adAsked) return; // already asked: never touch this slot again
  const holder = wrap; // "wrap" is one .ad-outstream-wrapper (one ad)
  wrap.__adAsked = true;
  const no = wrap.__adNo = wrap.__adNo || ++adSlotNo;

  holder.innerHTML = `<ins class="eas6a97888e37" data-zoneid="5993834"></ins>`;
  const ins = holder.firstElementChild;
  (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  adLog(`slot ${no}: asked for an ad (one time only)`);

  // An ad counts as shown once ExoClick has put anything inside the space.
  const adShown = () => {
    if (!holder.contains(ins)) return holder.childElementCount > 0; // library swapped our <ins> for its own element
    return ins.childElementCount > 0 || !!ins.shadowRoot;
  };

  const started = Date.now();
  const watcher = new MutationObserver(() => { if (adShown()) lockIn(); });
  watcher.observe(holder, { childList: true, subtree: true });

  function lockIn() {
    wrap.__adShown = true;
    watcher.disconnect();
    adLog(`slot ${no}: ad loaded after about ${Math.round((Date.now() - started) / 100) / 10}s`);
    logIfReplaced();
  }

  // Log only (changes nothing): reports if ExoClick replaces the ad after it loaded
  function logIfReplaced() {
    const lockedAt = Date.now();
    let noted = 0;
    const el = holder.contains(ins) ? ins : holder.firstElementChild;
    new MutationObserver((ms) => {
      if (Date.now() - lockedAt < 4000) return; // still settling in
      const swapped = ms.some(m => (m.target === holder || m.target === el) && (m.addedNodes.length || m.removedNodes.length));
      if (!swapped || Date.now() - noted < 5000) return;
      noted = Date.now();
      adLog(`slot ${no}: the ad was REPLACED after it loaded (done by ExoClick itself) at scroll position ${Math.round(window.pageYOffset)}`);
    }).observe(holder, { childList: true, subtree: true });
  }
}

// ============================================
// LAZY IMAGE LOADING
// ============================================
const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      const src = img.dataset.src;
      if (!src) return;

      // Preload then swap so blur clears only once image is actually ready
      const preload = new Image();
      preload.onload = () => {
        img.src = src;
        img.classList.remove("lazy-img");
      };
      preload.onerror = () => {
        img.src = src; // still swap so it doesn't stay stuck forever
        img.classList.remove("lazy-img");
      };
      preload.src = src;

      lazyObserver.unobserve(img);
    }
  });
}, { rootMargin: "300px", threshold: 0.01 });

function initLazyLoad() {
  document.querySelectorAll("img.lazy-img").forEach(img => lazyObserver.observe(img));
}

// ============================================
// AUTO VIDEO THUMBNAILS
// For videos with no thumbnail, load the video
// element when it scrolls into view so browser
// shows the frame at t=3 seconds as preview
// ============================================
const videoThumbObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const vid = entry.target;
      if (vid.dataset.src) {
        vid.src = vid.dataset.src;
        vid.removeAttribute("data-src");
        // Load enough to show the poster frame
        vid.load();
      }
      videoThumbObserver.unobserve(vid);
    }
  });
}, { rootMargin: "100px", threshold: 0 });

function initVideoThumbnails() {
  document.querySelectorAll("video.card-thumb-video").forEach(vid => {
    videoThumbObserver.observe(vid);
  });
}

// ============================================
// INFINITE SCROLL
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
// INIT
// ============================================
ensureExoclickScript(); // start fetching the ad library right away

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