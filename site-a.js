/* ============================================
   site-a.js — shared ExoClick ad slots
   Video slider ad zone 5980730 (in every slot and at the bottom of the page).
   Loaded by every page that shows ads.

   HOW TO USE ON A PAGE
   1) Add  <script src="/site-a.js" defer></script>  in <head>
   2) Put an empty  <div class="page-ad" data-ad-slot></div>  where an ad should appear
   3) Optional: ads inside an article, after every N elements. Add to <body>:
        data-ad-inject="#articleBody p"  data-ad-every="2"
   4) The bottom ad is added automatically at the end of every page.

   An empty slot is asked again (waits 2s, then 4s, 6s ... up to 30s).
   Every slot runs the video slider ad (zone 5980730). A slot that has shown an
   ad is locked and never reloaded.
   ============================================ */
(function () {
  "use strict";

  var ZONE = "5980730";           // video slider ad: used in every slot
  var INS_CLASS = "eas6a97888e31";
  var BOTTOM_ZONE = "5980730";
  var BOTTOM_CLASS = "eas6a97888e31";

  var GAP_MS = 500;         // wait between each ad (first ad starts immediately)
  var BATCH = 1;            // ads started per round
  var STAGGER_MS = 500;     // gap between ads inside a round
  var CHECK_MS = 2000;      // first wait before asking again
  var STEP_MS = 2000;       // each retry waits this much longer
  var MAX_WAIT_MS = 30000;  // longest wait between retries

  // ---------- styles (self-contained) ----------
  var css = [
    ".page-ad{position:relative;display:flex;align-items:center;justify-content:center;",
    "  min-height:270px;padding:22px 12px 12px;box-sizing:border-box;border-radius:12px;",
    "  background:rgba(127,127,127,.08);border:1px dashed rgba(127,127,127,.35);",
    "  margin:24px auto;width:min(1100px,92%);overflow:hidden}",
    ".page-ad::before{content:'Advertisement';position:absolute;top:6px;left:12px;font-size:10px;",
    "  font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.6}",
    ".page-ad-holder{width:300px;max-width:100%;height:250px;overflow:hidden;margin:0 auto}",
    ".page-ad-holder ins." + INS_CLASS + "{width:100%!important;height:100%!important}",
    ".page-ad-bottom{margin-bottom:80px}",
    /* side-by-side rows: ad on one side, content on the other */
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

  // ---------- load the ad library through our own domain ----------
  function ensureLibrary() {
    window.AdProvider = window.AdProvider || [];
    if (window.__adLibLoaded) return;
    if (document.querySelector('script[src*="ad-provider.js"], script[src*="/js/sdk.js"]')) return;
    window.__adLibLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.type = "application/javascript";
    s.src = "/js/sdk.js";
    document.head.appendChild(s);
  }

  // ---------- one ad: retry while empty, lock once shown ----------
  function loadAd(slot, attempt) {
    attempt = attempt || 0;
    if (slot.__adShown) return; // already has its ad: never touch it again
    var holder = slot.querySelector(".page-ad-holder");
    if (!holder) return;

    var zone = slot.getAttribute("data-zone") || ZONE;
    var cls = slot.getAttribute("data-ins-class") || INS_CLASS;
    holder.innerHTML = '<ins class="' + cls + '" data-zoneid="' + zone + '"></ins>';
    var ins = holder.firstElementChild;
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });

    var shown = function () { return ins.childElementCount > 0 || !!ins.shadowRoot; };
    var timer = null, watcher = null;
    var lock = function () {
      slot.__adShown = true;
      clearInterval(timer);
      if (watcher) watcher.disconnect();
    };

    if (window.MutationObserver) {
      watcher = new MutationObserver(function () { if (shown()) lock(); });
      watcher.observe(ins, { childList: true, subtree: true });
    }

    var started = Date.now();
    var waitMs = Math.min(CHECK_MS + attempt * STEP_MS, MAX_WAIT_MS);
    timer = setInterval(function () {
      if (slot.__adShown) { lock(); return; }
      if (!document.body.contains(slot) || !holder.contains(ins)) {
        clearInterval(timer);
        if (watcher) watcher.disconnect();
        return;
      }
      if (shown()) {
        lock();
      } else if (Date.now() - started >= waitMs) {
        clearInterval(timer);
        if (watcher) watcher.disconnect();
        loadAd(slot, attempt + 1); // still empty: ask again, quietly
      }
    }, 500);
  }

  // ---------- queue: one ad at a time, first one immediately ----------
  var queue = [];
  var running = false;

  function add(slot) {
    if (!slot || slot.__adQueued) return;
    slot.__adQueued = true;
    if (!slot.querySelector(".page-ad-holder")) {
      var h = document.createElement("div");
      h.className = "page-ad-holder";
      slot.appendChild(h);
    }
    queue.push(slot);
    if (running) return;
    running = true;
    (function next() {
      if (!queue.length) { running = false; return; }
      for (var i = 0; i < BATCH && queue.length; i++) {
        (function (s, delay) {
          setTimeout(function () { if (document.body.contains(s)) loadAd(s, 0); }, delay);
        })(queue.shift(), i * STAGGER_MS);
      }
      setTimeout(next, GAP_MS);
    })();
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
    slot.setAttribute("data-zone", BOTTOM_ZONE);
    slot.setAttribute("data-ins-class", BOTTOM_CLASS);
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