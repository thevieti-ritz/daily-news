// ============================================
// ADMIN.JS — Admin Panel Logic
// Handles video upload, editing, deleting,
// stats dashboard — admin only
// ============================================

import { db, auth } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, serverTimestamp, query, orderBy, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================================
// ⚠️ IMPORTANT: Replace this with YOUR email address
// Only this email will be able to access the admin panel
// ============================================================
const ADMIN_EMAIL = "dbernardinvestments@gmail.com";

// ---- DOM REFS ----
const accessDenied = document.getElementById("accessDenied");
const adminWrap = document.getElementById("adminWrap");
const adminUserName = document.getElementById("adminUserName");
const adminLogout = document.getElementById("adminLogout");

const uploadMessage = document.getElementById("uploadMessage");
const videoTitleInput = document.getElementById("videoTitle");
const archiveIdInput = document.getElementById("archiveId");
const thumbnailInput = document.getElementById("thumbnailUrl");
const categorySelect = document.getElementById("videoCategory");
const descriptionInput = document.getElementById("videoDescription");
const tagsInput = document.getElementById("videoTags");
const isFeaturedInput = document.getElementById("isFeatured");
const uploadBtn = document.getElementById("uploadBtn");

const manageList = document.getElementById("manageList");
const managerSearch = document.getElementById("managerSearch");

const editModal = document.getElementById("editModal");
const closeEditModal = document.getElementById("closeEditModal");
const saveEditBtn = document.getElementById("saveEditBtn");

let allVideos = [];

// ---- AUTH CHECK ----
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    accessDenied.classList.remove("hidden");
    return;
  }

  // Admin confirmed
  adminWrap.classList.remove("hidden");
  adminUserName.textContent = user.displayName || user.email;
  loadDashboard();
  loadVideosForManager();
});

adminLogout?.addEventListener("click", (e) => {
  e.preventDefault();
  signOut(auth).then(() => window.location.href = "index.html");
});

// ---- UPLOAD VIDEO ----
uploadBtn?.addEventListener("click", async () => {
  const title = videoTitleInput.value.trim();
  const archiveId = archiveIdInput.value.trim();
  const category = categorySelect.value;

  if (!title) { showUploadMsg("Please enter a video title.", "error"); return; }
  if (!archiveId) { showUploadMsg("Please enter the Archive.org embed ID.", "error"); return; }
  if (!category) { showUploadMsg("Please select a category.", "error"); return; }

  // Clean up archive ID (remove full URL if pasted by mistake)
  const cleanId = archiveId
    .replace("https://archive.org/details/", "")
    .replace("https://archive.org/embed/", "")
    .replace(/\/$/, "")
    .trim();

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

  try {
    const tags = tagsInput.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const thumbnail = thumbnailInput.value.trim() || `https://archive.org/services/img/${cleanId}`;

    await addDoc(collection(db, "videos"), {
      title,
      archiveId: cleanId,
      thumbnail,
      category,
      description: descriptionInput.value.trim(),
      tags,
      featured: isFeaturedInput.checked,
      views: 0,
      likes: 0,
      likedBy: [],
      createdAt: serverTimestamp()
    });

    showUploadMsg(`✅ "${title}" published successfully!`, "success");

    // Clear form
    videoTitleInput.value = "";
    archiveIdInput.value = "";
    thumbnailInput.value = "";
    categorySelect.value = "";
    descriptionInput.value = "";
    tagsInput.value = "";
    isFeaturedInput.checked = false;

    // Refresh
    loadDashboard();
    loadVideosForManager();

  } catch (err) {
    showUploadMsg("Error: " + err.message, "error");
  }

  uploadBtn.disabled = false;
  uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish Video';
});

// ---- DASHBOARD STATS ----
async function loadDashboard() {
  try {
    const snap = await getDocs(collection(db, "videos"));
    let totalViews = 0, totalLikes = 0, totalComments = 0;

    for (const d of snap.docs) {
      const data = d.data();
      totalViews += data.views || 0;
      totalLikes += data.likes || 0;
      // Count comments subcollection
      try {
        const commentSnap = await getCountFromServer(collection(db, "videos", d.id, "comments"));
        totalComments += commentSnap.data().count || 0;
      } catch {}
    }

    document.getElementById("totalVideos").textContent = snap.size;
    document.getElementById("totalViews").textContent = formatNumber(totalViews);
    document.getElementById("totalLikes").textContent = formatNumber(totalLikes);
    document.getElementById("totalComments").textContent = formatNumber(totalComments);
  } catch (err) {
    console.error("Stats error:", err);
  }
}

// ---- LOAD VIDEOS FOR MANAGER ----
async function loadVideosForManager() {
  manageList.innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>`;
  try {
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allVideos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderManageList(allVideos);
  } catch (err) {
    manageList.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

function renderManageList(videos) {
  manageList.innerHTML = "";
  if (videos.length === 0) {
    manageList.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:24px">No videos found.</p>`;
    return;
  }
  videos.forEach(v => manageList.appendChild(createManageItem(v)));
}

function createManageItem(video) {
  const el = document.createElement("div");
  el.className = "manage-item";
  const thumb = video.thumbnail || `https://archive.org/services/img/${video.archiveId}`;
  el.innerHTML = `
    <img class="manage-thumb" src="${thumb}" alt="${escapeHtml(video.title)}"
         onerror="this.src='https://archive.org/services/img/${video.archiveId}'"/>
    <div class="manage-info">
      <h4>${escapeHtml(video.title)}</h4>
      <span><i class="fas fa-eye"></i> ${formatNumber(video.views||0)} · 
            <i class="fas fa-thumbs-up"></i> ${formatNumber(video.likes||0)} · 
            ${video.category || "general"}</span>
    </div>
    <div class="manage-actions">
      <button class="btn-edit" data-id="${video.id}"><i class="fas fa-pen"></i> Edit</button>
      <button class="btn-delete" data-id="${video.id}"><i class="fas fa-trash"></i></button>
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

// ---- MANAGER SEARCH ----
managerSearch?.addEventListener("input", () => {
  const q = managerSearch.value.toLowerCase();
  renderManageList(allVideos.filter(v =>
    v.title?.toLowerCase().includes(q) ||
    v.category?.toLowerCase().includes(q)
  ));
});

// ---- EDIT MODAL ----
function openEditModal(video) {
  document.getElementById("editVideoId").value = video.id;
  document.getElementById("editTitle").value = video.title || "";
  document.getElementById("editDescription").value = video.description || "";
  document.getElementById("editCategory").value = video.category || "news";
  document.getElementById("editThumbnail").value = video.thumbnail || "";
  editModal.classList.remove("hidden");
}

closeEditModal?.addEventListener("click", () => editModal.classList.add("hidden"));
editModal?.addEventListener("click", (e) => { if (e.target === editModal) editModal.classList.add("hidden"); });

saveEditBtn?.addEventListener("click", async () => {
  const id = document.getElementById("editVideoId").value;
  const title = document.getElementById("editTitle").value.trim();
  const description = document.getElementById("editDescription").value.trim();
  const category = document.getElementById("editCategory").value;
  const thumbnail = document.getElementById("editThumbnail").value.trim();

  if (!title) { alert("Title cannot be empty."); return; }

  saveEditBtn.disabled = true;
  saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    await updateDoc(doc(db, "videos", id), { title, description, category, thumbnail });
    editModal.classList.add("hidden");
    loadVideosForManager();
    loadDashboard();
  } catch (err) {
    alert("Error saving: " + err.message);
  }

  saveEditBtn.disabled = false;
  saveEditBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
});

// ---- HELPERS ----
function showUploadMsg(msg, type) {
  uploadMessage.textContent = msg;
  uploadMessage.className = `admin-message ${type}`;
  uploadMessage.classList.remove("hidden");
  setTimeout(() => uploadMessage.classList.add("hidden"), 5000);
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function escapeHtml(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}