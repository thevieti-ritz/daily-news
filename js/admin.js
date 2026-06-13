// ============================================
// ADMIN.JS — Leaked Archives
// Cloudflare R2 video hosting
// Auto thumbnail generation
// ============================================

import { db, auth } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, serverTimestamp, query, orderBy, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================
// CONFIG
// ============================================
const ADMIN_EMAIL = "dbernardinvestments@gmail.com";
const R2_BASE     = "https://pub-947189f89d8c4deba38620dab133e00a.r2.dev/";

// ============================================
// DOM REFS
// ============================================
const accessDenied    = document.getElementById("accessDenied");
const adminWrap       = document.getElementById("adminWrap");
const adminUserName   = document.getElementById("adminUserName");
const adminLogout     = document.getElementById("adminLogout");
const uploadMessage   = document.getElementById("uploadMessage");
const videoTitleInput = document.getElementById("videoTitle");
const videoUrlInput   = document.getElementById("archiveId");
const thumbnailInput  = document.getElementById("thumbnailUrl");
const categorySelect  = document.getElementById("videoCategory");
const qualitySelect   = document.getElementById("videoQuality");
const durationInput   = document.getElementById("videoDuration");
const descriptionInput= document.getElementById("videoDescription");
const tagsInput       = document.getElementById("videoTags");
const isFeaturedInput = document.getElementById("isFeatured");
const uploadBtn       = document.getElementById("uploadBtn");
const manageList      = document.getElementById("manageList");
const managerSearch   = document.getElementById("managerSearch");
const editModal       = document.getElementById("editModal");
const closeEditModal  = document.getElementById("closeEditModal");
const saveEditBtn     = document.getElementById("saveEditBtn");

let allVideos = [];

// ============================================
// AUTH CHECK
// ============================================
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  if (user.email !== ADMIN_EMAIL) {
    accessDenied.classList.remove("hidden");
    return;
  }
  adminWrap.classList.remove("hidden");
  adminUserName.textContent = user.displayName || user.email;
  loadDashboard();
  loadVideosForManager();
});

adminLogout?.addEventListener("click", (e) => {
  e.preventDefault();
  signOut(auth).then(() => window.location.href = "index.html");
});

// ============================================
// CLEAN VIDEO ID
// Accepts full URL or filename, returns filename only
// ============================================
function cleanVideoId(input) {
  let id = input.trim();
  if (id.includes("r2.dev/")) id = id.split("r2.dev/").pop();
  else if (id.startsWith("http") && id.includes("/")) id = id.split("/").pop();
  return id;
}

// ============================================
// AUTO GENERATE THUMBNAIL FROM VIDEO
// Captures frame at 3 seconds using canvas
// ============================================
function generateThumbnail(videoUrl) {
  return new Promise((resolve) => {
    try {
      const video       = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload     = "metadata";
      video.muted       = true;
      video.src         = videoUrl;

      const cleanup = () => { video.src = ""; };
      const timeout = setTimeout(() => { cleanup(); resolve(""); }, 15000);

      video.addEventListener("loadedmetadata", () => {
        video.currentTime = Math.min(3, video.duration * 0.1 || 3);
      });

      video.addEventListener("seeked", () => {
        try {
          const canvas    = document.createElement("canvas");
          canvas.width    = 640;
          canvas.height   = 360;
          canvas.getContext("2d").drawImage(video, 0, 0, 640, 360);
          const dataUrl   = canvas.toDataURL("image/jpeg", 0.85);
          clearTimeout(timeout);
          cleanup();
          resolve(dataUrl);
        } catch(e) {
          clearTimeout(timeout);
          cleanup();
          resolve("");
        }
      });

      video.addEventListener("error", () => {
        clearTimeout(timeout);
        cleanup();
        resolve("");
      });

    } catch(e) {
      resolve("");
    }
  });
}

// ============================================
// UPLOAD VIDEO
// ============================================
uploadBtn?.addEventListener("click", async () => {
  const title    = videoTitleInput.value.trim();
  const rawInput = videoUrlInput.value.trim();
  const category = categorySelect.value;

  if (!title)    { showUploadMsg("Please enter a video title.", "error"); return; }
  if (!rawInput) { showUploadMsg("Please enter the video filename or URL.", "error"); return; }
  if (!category) { showUploadMsg("Please select a category.", "error"); return; }

  const cleanId  = cleanVideoId(rawInput);
  const videoUrl = cleanId.startsWith("http") ? cleanId : R2_BASE + cleanId;
  const tags     = tagsInput.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const quality  = qualitySelect?.value || "";
  const duration = parseInt(durationInput?.value) || 0;

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

  // Auto generate thumbnail if none provided
  let thumbnail = thumbnailInput.value.trim();
  if (!thumbnail) {
    showUploadMsg("Generating thumbnail from video...", "success");
    thumbnail = await generateThumbnail(videoUrl);
    if (thumbnail) {
      showUploadMsg("Thumbnail generated! Saving video...", "success");
    }
  }

  try {
    await addDoc(collection(db, "videos"), {
      title,
      archiveId:   cleanId,
      videoUrl,
      thumbnail,
      category,
      description: descriptionInput.value.trim(),
      tags,
      quality,
      duration,
      featured:    isFeaturedInput.checked,
      views:       0,
      likes:       0,
      likedBy:     [],
      createdAt:   serverTimestamp()
    });

    showUploadMsg(`✅ "${title}" published successfully!`, "success");

    // Clear form
    videoTitleInput.value   = "";
    videoUrlInput.value     = "";
    thumbnailInput.value    = "";
    categorySelect.value    = "";
    descriptionInput.value  = "";
    tagsInput.value         = "";
    isFeaturedInput.checked = false;
    if (qualitySelect) qualitySelect.value = "";
    if (durationInput) durationInput.value = "";

    loadDashboard();
    loadVideosForManager();

  } catch (err) {
    showUploadMsg("Error: " + err.message, "error");
  }

  uploadBtn.disabled = false;
  uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish Video';
});

// ============================================
// DASHBOARD STATS
// ============================================
async function loadDashboard() {
  try {
    const snap = await getDocs(collection(db, "videos"));
    let totalViews = 0, totalLikes = 0, totalComments = 0;
    for (const d of snap.docs) {
      const data = d.data();
      totalViews += data.views || 0;
      totalLikes += data.likes || 0;
      try {
        const cs = await getCountFromServer(
          collection(db, "videos", d.id, "comments")
        );
        totalComments += cs.data().count || 0;
      } catch {}
    }
    document.getElementById("totalVideos").textContent   = snap.size;
    document.getElementById("totalViews").textContent    = formatNumber(totalViews);
    document.getElementById("totalLikes").textContent    = formatNumber(totalLikes);
    document.getElementById("totalComments").textContent = formatNumber(totalComments);
  } catch (err) {
    console.error("Stats error:", err);
  }
}

// ============================================
// VIDEO MANAGER
// ============================================
async function loadVideosForManager() {
  manageList.innerHTML = `
    <div class="loading-screen">
      <div class="spinner"></div><p>Loading...</p>
    </div>`;
  try {
    const q    = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allVideos  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderManageList(allVideos);
  } catch (err) {
    manageList.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

function renderManageList(videos) {
  manageList.innerHTML = "";
  if (videos.length === 0) {
    manageList.innerHTML = `
      <p style="color:var(--muted);font-size:13px;text-align:center;padding:24px">
        No videos found.
      </p>`;
    return;
  }
  videos.forEach(v => manageList.appendChild(createManageItem(v)));
}

function createManageItem(video) {
  const el     = document.createElement("div");
  el.className = "manage-item";

  // Show thumbnail or video frame
  const thumbHtml = video.thumbnail
    ? `<img class="manage-thumb" src="${video.thumbnail}"
           alt="${escapeHtml(video.title)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
       <video class="manage-thumb" style="display:none;" muted preload="metadata"
           src="${(video.archiveId?.startsWith('http') ? video.archiveId : R2_BASE + (video.archiveId || ''))}#t=3">
       </video>`
    : `<video class="manage-thumb" muted preload="metadata"
           src="${(video.archiveId?.startsWith('http') ? video.archiveId : R2_BASE + (video.archiveId || ''))}#t=3"
           onerror="this.style.background='#333'">
       </video>`;

  el.innerHTML = `
    ${thumbHtml}
    <div class="manage-info">
      <h4>${escapeHtml(video.title)}</h4>
      <span>
        <i class="fas fa-eye"></i> ${formatNumber(video.views || 0)} ·
        <i class="fas fa-thumbs-up"></i> ${formatNumber(video.likes || 0)} ·
        ${video.category || "general"}
      </span>
    </div>
    <div class="manage-actions">
      <button class="btn-edit"><i class="fas fa-pen"></i> Edit</button>
      <button class="btn-delete"><i class="fas fa-trash"></i></button>
    </div>`;

  el.querySelector(".btn-edit").addEventListener("click", () => openEditModal(video));
  el.querySelector(".btn-delete").addEventListener("click", async () => {
    if (confirm(`Delete "${video.title}"? This cannot be undone.`)) {
      await deleteDoc(doc(db, "videos", video.id));
      el.remove();
      loadDashboard();
    }
  });
  return el;
}

// ============================================
// MANAGER SEARCH
// ============================================
managerSearch?.addEventListener("input", () => {
  const q = managerSearch.value.toLowerCase();
  renderManageList(allVideos.filter(v =>
    v.title?.toLowerCase().includes(q) ||
    v.category?.toLowerCase().includes(q)
  ));
});

// ============================================
// EDIT MODAL
// ============================================
function openEditModal(video) {
  document.getElementById("editVideoId").value     = video.id;
  document.getElementById("editTitle").value       = video.title       || "";
  document.getElementById("editDescription").value = video.description || "";
  document.getElementById("editCategory").value    = video.category    || "";
  document.getElementById("editThumbnail").value   = video.thumbnail   || "";
  const eq = document.getElementById("editQuality");
  if (eq) eq.value = video.quality || "";
  editModal.classList.remove("hidden");
}

closeEditModal?.addEventListener("click", () => editModal.classList.add("hidden"));
editModal?.addEventListener("click", (e) => {
  if (e.target === editModal) editModal.classList.add("hidden");
});

saveEditBtn?.addEventListener("click", async () => {
  const id          = document.getElementById("editVideoId").value;
  const title       = document.getElementById("editTitle").value.trim();
  const description = document.getElementById("editDescription").value.trim();
  const category    = document.getElementById("editCategory").value;
  const thumbnail   = document.getElementById("editThumbnail").value.trim();
  const quality     = document.getElementById("editQuality")?.value || "";

  if (!title) { alert("Title cannot be empty."); return; }

  saveEditBtn.disabled  = true;
  saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    await updateDoc(doc(db, "videos", id), {
      title, description, category, thumbnail, quality
    });
    editModal.classList.add("hidden");
    loadVideosForManager();
    loadDashboard();
  } catch (err) {
    alert("Error saving: " + err.message);
  }

  saveEditBtn.disabled  = false;
  saveEditBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
});

// ============================================
// HELPERS
// ============================================
function showUploadMsg(msg, type) {
  uploadMessage.textContent = msg;
  uploadMessage.className   = `admin-message ${type}`;
  uploadMessage.classList.remove("hidden");
  if (type !== "success" || msg.includes("✅")) {
    setTimeout(() => uploadMessage.classList.add("hidden"), 5000);
  }
}
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "K";
  return n.toString();
}
function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}