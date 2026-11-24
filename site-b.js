/* ============================================
   site-b.js — bonepa.com 320x50 banner slots

   Separate from site-a.js (ExoClick). Works with worker-b.js:
     - BANNER_SCRIPT below must match the route worker-b.js serves
       (/js/v1/b/js/responsive.js)
     - the worker route  yourdomain.com/js/v1/b/*  must point to worker-b.js

   HOW TO USE ON A PAGE
   1) Add  <script src="/site-b.js" defer></script>  in <head>
   2) Put an empty  <div data-ad-banner></div>  where the banner should appear

   Each banner asks for its ad ONCE, shortly before it scrolls into view,
   and only while the tab is visible. Never retried or refreshed.
   ============================================ */
(function () {
  "use strict";

  var BANNER_SCRIPT = "/js/v1/b/js/responsive.js";   // served by worker-b.js
  var BANNER_CLASS = "ub57653137f";
  var BANNER_AFFQUERY = "/651eebb8812b1161a094/b57653137f/?placementName=banner";

  var LAZY_MARGIN = "300px 0px";   // load shortly before the banner is visible
  var MIN_GAP_MS = 1000;           // minimum time between banner requests

  // ---------- styles (self-contained) ----------
  var css = [
    ".page-ad-banner{display:flex;justify-content:center;align-items:center;",
    "  min-height:50px;margin:16px auto;max-width:100%}"
  ].join("\n");

  function addStyles() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- one banner: ask once, never retry or refresh ----------
  // The <script> is created as a real element: scripts added through
  // innerHTML never run.
  function loadBanner(slot) {
    if (slot.__adAsked) return;
    slot.__adAsked = true;

    var ins = document.createElement("ins");
    ins.className = BANNER_CLASS;
    ins.style.width = "320px";
    ins.style.height = "50px";
    ins.setAttribute("data-width", "320");
    ins.setAttribute("data-height", "50");
    ins.setAttribute("data-domain", "//" + location.host + "/js/v1/b");
    ins.setAttribute("data-affquery", BANNER_AFFQUERY);

    var sc = document.createElement("script");
    sc.async = true;
    sc.src = BANNER_SCRIPT;
    ins.appendChild(sc);

    slot.appendChild(ins);
  }

  // ---------- staggered queue: one request at a time, visible tab only ----------
  var queue = [];
  var pumping = false;
  var lastFire = 0;

  function pump() {
    if (pumping || !queue.length) return;
    if (document.visibilityState === "hidden") return; // resumes on visibilitychange
    pumping = true;
    var wait = Math.max(0, lastFire + MIN_GAP_MS - Date.now());
    setTimeout(function () {
      var slot = queue.shift();
      if (slot && document.body.contains(slot)) {
        loadBanner(slot);
        lastFire = Date.now();
      }
      pumping = false;
      pump();
    }, wait);
  }
  document.addEventListener("visibilitychange", pump);

  function enqueue(slot) {
    if (!document.body.contains(slot)) return;
    queue.push(slot);
    pump();
  }

  // ---------- only ask for a banner when its slot is about to be seen ----------
  var observer = null;
  function getObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        observer.unobserve(e.target);
        enqueue(e.target);
      });
    }, { rootMargin: LAZY_MARGIN });
    return observer;
  }

  function add(slot) {
    if (!slot || slot.__adQueued) return;
    slot.__adQueued = true;
    slot.classList.add("page-ad-banner");
    if ("IntersectionObserver" in window) getObserver().observe(slot);
    else enqueue(slot);
  }

  window.BannerSlots = { add: add };

  function init() {
    addStyles();
    var slots = document.querySelectorAll("[data-ad-banner]");
    for (var i = 0; i < slots.length; i++) add(slots[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();