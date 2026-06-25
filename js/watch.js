// ============================================
// WATCH.JS — Leaked Archives
// Cloudflare R2 + Video.js + ExoClick VAST
// ============================================

import { db, auth } from "./firebase.js";
import {
  doc, getDoc, getDocs, updateDoc, increment,
  collection, query, orderBy, addDoc, deleteDoc,
  serverTimestamp, limit, where, arrayUnion, arrayRemove, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================
// CONFIG
// ============================================
const ADMIN_EMAIL = "dbernardinvestments@gmail.com";
const R2_BASE     = "https://pub-947189f89d8c4deba38620dab133e00a.r2.dev/";
const VAST_URL    = "https://s.magsrv.com/v1/vast.php?idz=5947340";
const PLACEHOLDER = "https://via.placeholder.com/120x68/1a1a1a/e63946?text=Video";

// ============================================
// STATE
// ============================================
let currentVideoId = null;
let currentUser    = null;
let hasLiked       = false;
let viewTracked    = false;
let player         = null;

// ============================================
// GET VIDEO ID
// ============================================
const params = new URLSearchParams(window.location.search);
currentVideoId = params.get("v");
if (!currentVideoId) window.location.href = "index.html";

// ============================================
// DOM REFS
// ============================================
const videoTitle         = document.getElementById("videoTitle");
const videoCategoryBadge = document.getElementById("videoCategoryBadge");
const viewCount          = document.getElementById("viewCount");
const likeCount          = document.getElementById("likeCount");
const videoDate          = document.getElementById("videoDate");
const videoDescription   = document.getElementById("videoDescription");
const likeBtn            = document.getElementById("likeBtn");
const shareBtn           = document.getElementById("shareBtn");
const copyLinkBtn        = document.getElementById("copyLinkBtn");
const relatedVideos      = document.getElementById("relatedVideos");
const commentsList       = document.getElementById("commentsList");
const commentInput       = document.getElementById("commentInput");
const postCommentBtn     = document.getElementById("postCommentBtn");
const commentCount       = document.getElementById("commentCount");
const commentUserAvatar  = document.getElementById("commentUserAvatar");
const shareModal         = document.getElementById("shareModal");
const closeShareModal    = document.getElementById("closeShareModal");
const authLink           = document.getElementById("authLink");
const userMenu           = document.getElementById("userMenu");
const userAvatar         = document.getElementById("userAvatar");
const userDisplayName    = document.getElementById("userDisplayName");
const logoutBtn          = document.getElementById("logoutBtn");
const breadcrumbTitle    = document.getElementById("breadcrumbTitle");

// ============================================
// AUTH
// ============================================
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authLink?.classList.add("hidden");
    userMenu?.classList.remove("hidden");
    if (userDisplayName) userDisplayName.textContent = user.displayName || user.email.split("@")[0];
    if (userAvatar)      userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.uid}`;
    if (commentUserAvatar) commentUserAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.uid}`;
    if (commentInput) commentInput.placeholder = "Add a comment...";
  } else {
    authLink?.classList.remove("hidden");
    userMenu?.classList.add("hidden");
    if (commentInput) commentInput.placeholder = "Sign in to comment...";
  }
});

logoutBtn?.addEventListener("click", (e) => { e.preventDefault(); signOut(auth); });

// ============================================
// HELPERS
// ============================================
function getVideoUrl(archiveId) {
  if (!archiveId) return "";
  return archiveId.startsWith("http") ? archiveId : R2_BASE + archiveId;
}

function getThumbnail(video) {
  return video.thumbnail || "";
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function timeAgo(date) {
  const s = Math.floor((new Date() - date) / 1000);
  if (s < 60)      return "Just now";
  if (s < 3600)    return Math.floor(s / 60) + "m ago";
  if (s < 86400)   return Math.floor(s / 3600) + "h ago";
  if (s < 2592000) return Math.floor(s / 86400) + "d ago";
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ============================================
// SAVE TO HISTORY
// ============================================
async function saveToHistory(video) {
  if (!currentUser) return;
  try {
    await setDoc(
      doc(db, "users", currentUser.uid, "history", currentVideoId),
      {
        videoId:   currentVideoId,
        title:     video.title,
        thumbnail: getThumbnail(video),
        archiveId: video.archiveId,
        category:  video.category || "general",
        views:     video.views || 0,
        watchedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch(e) { console.error("History error:", e); }
}

// ============================================
// TRACK VIEW
// ============================================
async function trackView(video, videoRef) {
  if (viewTracked) return;
  viewTracked = true;
  try {
    await updateDoc(videoRef, { views: increment(1) });
    const snap = await getDoc(videoRef);
    if (viewCount) viewCount.textContent = formatNumber(snap.data().views || 0);
    saveToHistory(video);
  } catch(e) { console.error("View error:", e); }
}

// ============================================
// INIT PLAYER
// ============================================
function initPlayer(videoUrl, posterUrl, video, videoRef) {
  if (player) { try { player.dispose(); } catch(e) {} player = null; }

  // HTML5 fallback if Video.js not loaded
  if (typeof videojs === "undefined") {
    const wrap = document.querySelector(".player-wrap");
    wrap.innerHTML = `<video controls playsinline preload="auto"
      src="${videoUrl}" poster="${posterUrl}"
      style="width:100%;height:100%;background:#000;">
    </video>`;
    wrap.querySelector("video").addEventListener("timeupdate", function() {
      if (this.currentTime >= 5) trackView(video, videoRef);
    });
    return;
  }

  // Recreate video element fresh
  const wrap = document.querySelector(".player-wrap");
  wrap.innerHTML = `<video id="myPlayer"
    class="video-js vjs-default-skin vjs-big-play-centered vjs-16-9"
    controls playsinline preload="auto">
  </video>`;

  player = videojs("myPlayer", {
    controls:    true,
    autoplay:    false,
    preload:     "auto",
    fluid:       true,
    playsinline: true,
    poster:      posterUrl || "",
    sources:     [{ src: videoUrl, type: "video/mp4" }]
  });

  player.ready(function() {
    // Init VAST ads
    if (typeof player.ima === "function" && !window.imaFailed) {
      try {
        player.ima({
          adTagUrl:        VAST_URL,
          debug:           false,
          disableFlashAds: true,
          showCountdown:   true,
          adLabel:         "Advertisement",
          timeout:         5000
        });
        player.on("ads-ad-error", () => {
          try { player.ads.endLinearAdMode(); } catch(e) {}
        });
      } catch(e) {
        console.warn("IMA init error:", e);
      }
    }

    // Track view after 5 seconds
    player.on("timeupdate", () => {
      if (player.currentTime() >= 5) trackView(video, videoRef);
    });

    player.on("error", () => {
      console.error("Player error:", player.error());
    });
  });
}

// ============================================
// LOAD VIDEO
// ============================================
async function loadVideo() {
  try {
    const videoRef  = doc(db, "videos", currentVideoId);
    const videoSnap = await getDoc(videoRef);

    if (!videoSnap.exists()) {
      if (videoTitle) videoTitle.textContent = "Video not found";
      return;
    }

    const video    = { id: videoSnap.id, ...videoSnap.data() };
    const videoUrl = getVideoUrl(video.archiveId);
    const poster   = getThumbnail(video);

    document.title = `${video.title} — Leaked Archives`;
    if (breadcrumbTitle) breadcrumbTitle.textContent = video.title;

    if (videoTitle)         videoTitle.textContent         = video.title;
    if (videoCategoryBadge) videoCategoryBadge.textContent = video.category || "general";
    if (viewCount)          viewCount.textContent          = formatNumber(video.views || 0);
    if (likeCount)          likeCount.textContent          = formatNumber(video.likes || 0);
    if (videoDate)          videoDate.textContent          = video.createdAt
      ? video.createdAt.toDate().toLocaleDateString("en-UG", { year:"numeric", month:"long", day:"numeric" })
      : "";
    if (videoDescription) videoDescription.textContent = video.description || "";

    if (video.likedBy && auth.currentUser) {
      hasLiked = video.likedBy.includes(auth.currentUser.uid);
      if (hasLiked) likeBtn?.classList.add("liked");
    }

    // Share links
    const shareUrl  = encodeURIComponent(window.location.href);
    const shareText = encodeURIComponent(`Watch: ${video.title}`);
    const el = (id) => document.getElementById(id);
    if (el("shareWhatsapp")) el("shareWhatsapp").href = `https://wa.me/?text=${shareText}%20${shareUrl}`;
    if (el("shareFacebook")) el("shareFacebook").href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
    if (el("shareTwitter"))  el("shareTwitter").href  = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
    if (el("shareTelegram")) el("shareTelegram").href = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;

    // Init player after page fully loaded
    if (document.readyState === "complete") {
      initPlayer(videoUrl, poster, video, videoRef);
    } else {
      window.addEventListener("load", () => initPlayer(videoUrl, poster, video, videoRef));
    }

    loadRelated(video.category, currentVideoId);
    loadComments();

  } catch(e) {
    console.error("Load video error:", e);
    if (videoTitle) videoTitle.textContent = "Error loading video";
  }
}

// ============================================
// LIKE
// ============================================
likeBtn?.addEventListener("click", async () => {
  if (!currentUser) { window.location.href = "login.html"; return; }
  const videoRef = doc(db, "videos", currentVideoId);
  if (hasLiked) {
    hasLiked = false;
    likeBtn.classList.remove("liked");
    await updateDoc(videoRef, { likes: increment(-1), likedBy: arrayRemove(currentUser.uid) });
  } else {
    hasLiked = true;
    likeBtn.classList.add("liked");
    await updateDoc(videoRef, { likes: increment(1), likedBy: arrayUnion(currentUser.uid) });
  }
  const snap = await getDoc(videoRef);
  if (likeCount) likeCount.textContent = formatNumber(snap.data().likes || 0);
});

// ============================================
// SHARE
// ============================================
shareBtn?.addEventListener("click", () => shareModal?.classList.remove("hidden"));
closeShareModal?.addEventListener("click", () => shareModal?.classList.add("hidden"));
shareModal?.addEventListener("click", (e) => { if (e.target === shareModal) shareModal.classList.add("hidden"); });
copyLinkBtn?.addEventListener("click", () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => { copyLinkBtn.innerHTML = '<i class="fas fa-link"></i> Copy Link'; }, 2000);
  });
});

// ============================================
// RELATED VIDEOS — with proper thumbnail display
// ============================================
async function loadRelated(category, excludeId) {
  try {
    let snap = await getDocs(query(
      collection(db, "videos"),
      where("category", "==", category),
      orderBy("createdAt", "desc"),
      limit(10)
    ));

    if (relatedVideos) relatedVideos.innerHTML = "";
    let count = 0;

    snap.docs.forEach(d => {
      if (d.id === excludeId || count >= 8) return;
      relatedVideos?.appendChild(createRelatedCard({ id: d.id, ...d.data() }));
      count++;
    });

    // Fallback — load any videos if none in same category
    if (count === 0) {
      const snap2 = await getDocs(query(
        collection(db, "videos"),
        orderBy("createdAt", "desc"),
        limit(9)
      ));
      snap2.docs.forEach(d => {
        if (d.id === excludeId) return;
        relatedVideos?.appendChild(createRelatedCard({ id: d.id, ...d.data() }));
      });
    }
  } catch(e) {
    if (relatedVideos) relatedVideos.innerHTML =
      "<p style='color:var(--muted);font-size:13px;padding:8px'>Could not load videos.</p>";
  }
}

function createRelatedCard(video) {
  const card     = document.createElement("div");
  card.className = "related-card";

  const videoUrl = getVideoUrl(video.archiveId);
  const thumb    = getThumbnail(video);

  // Thumbnail — image if available, video frame fallback
  const thumbHtml = thumb
    ? `<img src="${thumb}"
           alt="${escapeHtml(video.title)}"
           style="width:100%;height:100%;object-fit:cover;display:block;"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
       <video src="${videoUrl}#t=3" muted preload="metadata"
           style="display:none;width:100%;height:100%;object-fit:cover;"></video>`
    : `<video src="${videoUrl}#t=3" muted preload="metadata"
           style="width:100%;height:100%;object-fit:cover;display:block;"></video>`;

  card.innerHTML = `
    <div class="related-thumb-wrap">
      ${thumbHtml}
    </div>
    <div class="related-info">
      <h4>${escapeHtml(video.title)}</h4>
      <span>
        <i class="fas fa-eye"></i> ${formatNumber(video.views || 0)}
        &nbsp;·&nbsp; ${video.category || ""}
      </span>
    </div>`;

  card.addEventListener("click", () => {
    window.location.href = `watch.html?v=${video.id}`;
  });

  return card;
}

// ============================================
// COMMENTS
// ============================================
async function loadComments() {
  try {
    const snap = await getDocs(query(
      collection(db, "videos", currentVideoId, "comments"),
      orderBy("createdAt", "desc")
    ));
    if (commentsList)  commentsList.innerHTML   = "";
    if (commentCount)  commentCount.textContent = snap.size;
    if (snap.empty) {
      if (commentsList) commentsList.innerHTML =
        "<p style='color:var(--muted);font-size:13px;text-align:center;padding:20px'>No comments yet. Be the first!</p>";
      return;
    }
    snap.forEach(d => commentsList?.appendChild(createCommentEl({ id: d.id, ...d.data() })));
  } catch(e) { console.error("Comments error:", e); }
}

function createCommentEl(comment) {
  const el      = document.createElement("div");
  el.className  = "comment-item";
  const avatar  = comment.userPhoto || `https://api.dicebear.com/7.x/thumbs/svg?seed=${comment.userId}`;
  const timeStr = comment.createdAt ? timeAgo(comment.createdAt.toDate()) : "";
  const isOwner = currentUser && currentUser.uid === comment.userId;
  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;

  el.innerHTML = `
    <img class="comment-avatar" src="${avatar}" alt="${escapeHtml(comment.userName)}"/>
    <div class="comment-body">
      <div class="comment-name">${escapeHtml(comment.userName)} <span>${timeStr}</span></div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
      ${(isOwner || isAdmin)
        ? `<button class="comment-delete"><i class="fas fa-trash"></i> Delete</button>`
        : ""}
    </div>`;

  el.querySelector(".comment-delete")?.addEventListener("click", async () => {
    if (confirm("Delete this comment?")) {
      await deleteDoc(doc(db, "videos", currentVideoId, "comments", comment.id));
      el.remove();
      if (commentCount) commentCount.textContent =
        Math.max(0, (parseInt(commentCount.textContent) || 0) - 1);
    }
  });
  return el;
}

postCommentBtn?.addEventListener("click", postComment);
commentInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") postComment(); });

async function postComment() {
  if (!currentUser) { window.location.href = "login.html"; return; }
  const text = commentInput.value.trim();
  if (!text) return;
  postCommentBtn.disabled  = true;
  postCommentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const commentData = {
      text,
      userId:    currentUser.uid,
      userName:  currentUser.displayName || currentUser.email.split("@")[0],
      userPhoto: currentUser.photoURL || null,
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(
      collection(db, "videos", currentVideoId, "comments"),
      commentData
    );
    commentInput.value = "";
    if (commentsList?.querySelector("p")) commentsList.innerHTML = "";
    commentsList?.prepend(createCommentEl({
      id: ref.id, ...commentData, createdAt: { toDate: () => new Date() }
    }));
    if (commentCount) commentCount.textContent =
      (parseInt(commentCount.textContent) || 0) + 1;
  } catch(e) {
    alert("Error posting comment: " + e.message);
  }
  postCommentBtn.disabled  = false;
  postCommentBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
}

// ============================================
// INIT
// ============================================
if (document.readyState === "complete") {
  loadVideo();
} else {
  window.addEventListener("load", loadVideo);
}