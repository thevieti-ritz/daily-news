/* ============================================
   site-a.js — shared ExoClick ad slots
   Video slider zones (6092270, 6092276, 6092278), rotated across slots
   (including the bottom ad). Loaded by every page that shows ads.

   Works together with worker.js:
     - SDK_PATH below MUST equal SDK_PATH in worker.js ("/js/sdk.js")
     - the worker route must cover /js/*  (e.g. yourdomain.com/js/*)

   HOW TO USE ON A PAGE
   1) Add  <script src="/site-a.js" defer></script>  in <head>
   2) Put an empty  <div class="page-ad" data-ad-slot></div>  where an ad should appear
   3) Optional: ads inside an article, after every N elements. Add to <body>:
        data-ad-inject="#articleBody p"  data-ad-every="2"
   4) The bottom ad is added automatically at the end of every page.

   Each slot asks for its ad ONCE, as soon as it is anywhere near the
   screen, with no waiting line and no delay between ads. It is never
   retried or refreshed.
   ============================================ */
(function () {
  "use strict";

  var SDK_PATH = "/js/sdk.js";                      // served by worker.js
  var ZONES = ["6092270", "6092276", "6092278"];    // slots take them in turn
  var INS_CLASS = "eas6a97888e31";
  var zoneCounter = 0;

  var LAZY_MARGIN = "1500px 0px"; // start loading well before the slot is visible

  // ---------- styles (self-contained) ----------
  var css = [
    ".page-ad{position:relative;display:flex;align-items:center;justify-content:center;",
    "  min-height:420px;padding:22px 12px 12px;box-sizing:border-box;border-radius:12px;",
    "  background:rgba(127,127,127,.08);border:1px dashed rgba(127,127,127,.35);",
    "  margin:24px auto;width:min(1100px,92%);overflow:hidden}",
    ".page-ad::before{content:'Advertisement';position:absolute;top:6px;left:12px;font-size:10px;",
    "  font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.6}",
    ".page-ad-holder{width:100%;max-width:640px;height:360px;overflow:hidden;margin:0 auto}",
    ".page-ad-holder ins." + INS_CLASS + "{width:100%!important;height:100%!important}",
    ".page-ad-bottom{margin-bottom:80px}",
    ".ad-row{display:flex;gap:16px;align-items:flex-start;width:100%;margin:0 0 20px}",
    ".ad-row>.ad-col{flex:1 1 0;min-width:0}",
    ".ad-row>.page-ad{flex:0 0 316px;width:316px;margin:0;position:sticky;top:76px}",
    "@media (max-width:800px){",
    "  .ad-row{flex-direction:column;align-items:stretch}",
    "  .ad-row>.page-ad{flex:none;width:100%;position:relative;top:auto}",
    "}"
  ].join("\n");

  function addStyles() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- load the ad library through our own domain (worker.js) ----------
  function ensureLibrary() {
    window.AdProvider = window.AdProvider || [];
    if (window.__adLibLoaded) return;
    if (document.querySelector('script[src*="ad-provider.js"], script[src="' + SDK_PATH + '"]')) {
      window.__adLibLoaded = true;
      return;
    }
    window.__adLibLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.type = "application/javascript";
    s.src = SDK_PATH;
    document.head.appendChild(s);
  }

  // ---------- one ad: ask once, never retry or refresh ----------
  function loadAd(slot) {
    if (slot.__adAsked) return;
    var holder = slot.querySelector(".page-ad-holder");
    if (!holder) return;
    slot.__adAsked = true;

    var zone = slot.getAttribute("data-zone");
    if (!zone) {
      zone = ZONES[zoneCounter % ZONES.length];
      zoneCounter++; // next slot takes the next zone
    }
    var cls = slot.getAttribute("data-ins-class") || INS_CLASS;
    holder.innerHTML = '<ins class="' + cls + '" data-zoneid="' + zone + '"></ins>';
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }

  // ---------- no waiting line: every slot loads as soon as it is due ----------
  function enqueue(slot) {
    if (document.body.contains(slot)) loadAd(slot);
  }

  // ---------- only ask for an ad when its slot is about to be seen ----------
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
    if (!slot.querySelector(".page-ad-holder")) {
      var h = document.createElement("div");
      h.className = "page-ad-holder";
      slot.appendChild(h);
    }
    if ("IntersectionObserver" in window) getObserver().observe(slot);
    else enqueue(slot);
  }

  function create() {
    var d = document.createElement("div");
    d.className = "page-ad";
    d.innerHTML = '<div class="page-ad-holder"></div>';
    return d;
  }

  // ads inside an article: after every Nth element matching the selector
  function inject(selector, every) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      if ((i + 1) % every === 0 && nodes[i].parentNode) {
        var slot = create();
        nodes[i].parentNode.insertBefore(slot, nodes[i].nextSibling);
        add(slot);
      }
    }
  }

  // ---------- bottom ad on every page ----------
  function addBottomAd() {
    if (document.querySelector(".page-ad-bottom")) return;
    var slot = create();
    slot.className += " page-ad-bottom";
    document.body.appendChild(slot);
    add(slot);
  }

  window.AdSlots = { add: add, create: create, inject: inject };

  function init() {
    addStyles();
    ensureLibrary();
    var b = document.body;
    var sel = b.getAttribute("data-ad-inject");
    if (sel) inject(sel, parseInt(b.getAttribute("data-ad-every"), 10) || 2);
    var slots = document.querySelectorAll("[data-ad-slot]");
    for (var i = 0; i < slots.length; i++) add(slots[i]);
    addBottomAd();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();