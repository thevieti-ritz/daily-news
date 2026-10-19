/* ============================================
   ads.js — shared ExoClick outstream video ad slots
   Zone 5993834. Loaded by every page that shows ads.

   HOW TO USE ON A PAGE
   1) Add  <script src="/ads.js?v=1" defer></script>  in <head>
   2) Put an empty  <div class="page-ad" data-ad-slot></div>  where an ad should appear
   3) Every page that loads this file also gets the bottom-of-page ad (zone 5980730)
   4) Optional: ads inside an article, after every N elements. Add to <body>:
        data-ad-inject="#articleBody p"  data-ad-every="2"
      (the ad goes after every 2nd element that matches the selector)
   ============================================ */
(function () {
  "use strict";

  var ZONE = "5993834";
  var INS_CLASS = "eas6a97888e37";
  var BOTTOM_ZONE = "5980730";            // ad shown at the bottom of every page
  var BOTTOM_CLASS = "eas6a97888e31";

  var GAP_MS = 1000;        // wait between rounds of ads
  var BATCH = 3;            // ads started per round
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
    /* bottom-of-page ad: leave room for any banner size */
    ".page-ad-bottom{min-height:120px;margin:24px auto 80px}",
    ".page-ad-bottom .page-ad-holder{width:100%;height:auto;min-height:100px;overflow:visible}",
    ".page-ad-bottom .page-ad-holder ins{display:block;margin:0 auto}",
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

  // ---------- load the ExoClick library ----------
  function ensureLibrary() {
    window.AdProvider = window.AdProvider || [];
    if (document.querySelector('script[src*="ad-provider.js"]')) return;
    var s = document.createElement("script");
    s.async = true;
    s.type = "application/javascript";
    s.src = "https://a.magsrv.com/ad-provider.js";
    document.head.appendChild(s);
  }

  // ---------- one ad: ask, watch, ask again until it shows ----------
  function loadAd(slot, attempt) {
    attempt = attempt || 0;
    var holder = slot.querySelector(".page-ad-holder");
    if (!holder) return;

    var zone = slot.getAttribute("data-zone") || ZONE;
    var cls = slot.getAttribute("data-ins-class") || INS_CLASS;
    holder.innerHTML = '<ins class="' + cls + '" data-zoneid="' + zone + '"></ins>';
    var ins = holder.firstElementChild;
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });

    function shown() {
      var media = ins.querySelector("video,iframe,img,canvas");
      if (media) {
        if (media.tagName === "VIDEO" && media.error) return false;
        return true;
      }
      return ins.offsetHeight > 50;
    }

    var started = Date.now();
    var waitMs = Math.min(CHECK_MS + attempt * STEP_MS, MAX_WAIT_MS);
    var timer = setInterval(function () {
      if (!document.body.contains(slot) || !holder.contains(ins)) { clearInterval(timer); return; }
      if (shown()) {
        clearInterval(timer);
      } else if (Date.now() - started >= waitMs) {
        clearInterval(timer);
        loadAd(slot, attempt + 1);
      }
    }, 1000);
  }

  // ---------- queue: a few ads per second, slightly staggered ----------
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

  // the ad that sits at the very bottom of every page
  function addBottomAd() {
    if (document.querySelector('ins[data-zoneid="' + BOTTOM_ZONE + '"]')) return; // page already has it
    var d = document.createElement("div");
    d.className = "page-ad page-ad-bottom";
    d.setAttribute("data-zone", BOTTOM_ZONE);
    d.setAttribute("data-ins-class", BOTTOM_CLASS);
    d.innerHTML = '<div class="page-ad-holder"></div>';
    document.body.appendChild(d);
    add(d);
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