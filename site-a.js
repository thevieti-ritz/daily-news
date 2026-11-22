/* ============================================
   site-a.js — ExoClick ads (3 zones only)

     5980730  video slider      (class eas6a97888e31)
     6073390  video slider      (class eas6a97888e31)
     5993834  outstream video   (class eas6a97888e37)

   Works together with worker.js:
     - SDK_PATH below MUST equal the SDK route in worker.js ("/js/sdk.js")
     - the worker route must cover /js/*  (e.g. yourdomain.com/js/*)

   HOW TO USE ON A PAGE
   1) Add  <script src="/site-a.js" defer></script>  in <head>
   2) Sliders load by themselves. They need no markup. If both would overlap,
      the second one is stacked in a layer above (or below) the first.
   3) Outstream (one per page by default) goes, in this order of priority:
        a) into your own  <div class="page-ad" data-ad-slot></div>
        b) after every Nth element, if <body> has
             data-ad-inject="#articleBody p"  data-ad-every="4"
        c) otherwise at the end of the page

   Each zone asks for its ad ONCE per page. Nothing is retried or refreshed.
   Requests are staggered and only fire while the tab is visible.
   ============================================ */
(function () {
  "use strict";

  var SDK_PATH = "/js/sdk.js";           // served by worker.js

  var SLIDERS = [
    { zone: "5980730", cls: "eas6a97888e31" },
    { zone: "6073390", cls: "eas6a97888e31" }
  ];
  var OUTSTREAM = { zone: "5993834", cls: "eas6a97888e37" };

  var MAX_OUTSTREAM = 1;        // outstream placements per page
  var DEFAULT_EVERY = 4;        // default spacing for data-ad-inject
  var LAZY_MARGIN = "300px 0px";// outstream loads shortly before it is visible
  var MIN_GAP_MS = 1000;        // minimum time between ad requests
  var SLIDER_DELAY_MS = 1500;   // wait after page load before sliders start

  // ---------- styles ----------
  // An empty outstream slot takes no space. Once an ad renders into it,
  // the "filled" class adds the label and frame.
  var css = [
    ".page-ad{position:relative;display:flex;justify-content:center;width:min(1100px,92%);",
    "  margin:0 auto;box-sizing:border-box}",
    ".page-ad.filled{padding:22px 12px 12px;margin:24px auto;border-radius:12px;",
    "  background:rgba(127,127,127,.08);border:1px dashed rgba(127,127,127,.35)}",
    ".page-ad.filled::before{content:'Advertisement';position:absolute;top:6px;left:12px;",
    "  font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.6}",
    ".page-ad-holder{width:100%;display:flex;justify-content:center;align-items:center}",
    ".page-ad-holder ins{max-width:100%}",
    ".page-ad-bottom.filled{margin-bottom:80px}",
    ".ad-row{display:flex;gap:16px;align-items:flex-start;width:100%;margin:0 0 20px}",
    ".ad-row>.ad-col{flex:1 1 0;min-width:0}",
    ".ad-row>.page-ad{flex:0 0 316px;width:316px;margin:0;position:relative;top:auto}",
    "@media (max-width:800px){",
    "  .ad-row{flex-direction:column;align-items:stretch}",
    "  .ad-row>.page-ad{flex:none;width:100%}",
    "}"
  ].join("\n");

  function addStyles() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- ad library, loaded once through our own domain ----------
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

  // ---------- put an <ins> in a container and ask for the ad ----------
  function serve(zone, cls, container) {
    var ins = document.createElement("ins");
    ins.className = cls;
    ins.setAttribute("data-zoneid", zone);
    container.appendChild(ins);
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
    return ins;
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
      var job = queue.shift();
      if (job) {
        job();
        lastFire = Date.now();
      }
      pumping = false;
      pump();
    }, wait);
  }
  document.addEventListener("visibilitychange", pump);

  function enqueue(job) {
    queue.push(job);
    pump();
  }

  // ---------- video sliders: no markup, loaded once after the page is ready ----------
  var SLIDER_GAP_PX = 8;   // space between the two stacked sliders
  var sliderEls = [];      // the fixed-position element each slider renders
  var stackTimer = null;

  function isFixed(el) {
    return el.nodeType === 1 && getComputedStyle(el).position === "fixed";
  }

  // the slider's visible box: the first position:fixed element in or next to its <ins>
  function findFixed(root) {
    if (isFixed(root)) return root;
    var all = root.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) if (isFixed(all[i])) return all[i];
    return null;
  }

  function resetStack(b) {
    if (!b) return;
    b.style.removeProperty("bottom");
    b.style.removeProperty("top");
    b.__stacked = false;
  }

  // Put slider 2 in a second layer directly above (or below) slider 1,
  // but only if the two boxes would otherwise overlap.
  function applyStack() {
    var a = sliderEls[0], b = sliderEls[1];
    if (!a || !b) return;
    if (!document.body.contains(b)) { clearInterval(stackTimer); return; }
    if (!document.body.contains(a)) {   // slider 1 was closed: put slider 2 back
      resetStack(b);
      clearInterval(stackTimer);
      return;
    }
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    var overlap = !(ra.right <= rb.left || rb.right <= ra.left ||
                    ra.bottom <= rb.top || rb.bottom <= ra.top);
    if (!b.__stacked && !overlap) return;
    if (ra.top > window.innerHeight / 2) {         // bottom-anchored: stack upward
      b.style.setProperty("bottom", (window.innerHeight - ra.top + SLIDER_GAP_PX) + "px", "important");
      b.style.setProperty("top", "auto", "important");
    } else {                                       // top-anchored: stack downward
      b.style.setProperty("top", (ra.bottom + SLIDER_GAP_PX) + "px", "important");
      b.style.setProperty("bottom", "auto", "important");
    }
    b.__stacked = true;
  }

  function watchSlider(index, ins, before) {
    var tries = 0;
    (function check() {
      var el = findFixed(ins);
      if (!el) {
        var kids = document.body.children;
        for (var k = 0; k < kids.length && !el; k++) {
          if (before.indexOf(kids[k]) === -1 && kids[k].tagName !== "SCRIPT") el = findFixed(kids[k]);
        }
      }
      if (el) {
        sliderEls[index] = el;
        if (sliderEls[0] && sliderEls[1] && !stackTimer) {
          applyStack();
          stackTimer = setInterval(applyStack, 1000);
        }
        return;
      }
      if (tries++ < 20) setTimeout(check, 500);   // give up after about 10 seconds
    })();
  }

  function startSliders() {
    SLIDERS.forEach(function (z, i) {
      enqueue(function () {
        var before = Array.prototype.slice.call(document.body.children);
        var ins = serve(z.zone, z.cls, document.body);
        watchSlider(i, ins, before);
      });
    });
  }

  function scheduleSliders() {
    function go() { setTimeout(startSliders, SLIDER_DELAY_MS); }
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go);
  }

  // ---------- outstream: lazy, asks once, shows its frame only when filled ----------
  function loadOutstream(slot) {
    if (slot.__adAsked || !document.body.contains(slot)) return;
    var holder = slot.querySelector(".page-ad-holder");
    if (!holder) return;
    slot.__adAsked = true;

    var ins = serve(OUTSTREAM.zone, OUTSTREAM.cls, holder);

    if ("MutationObserver" in window) {
      var mo = new MutationObserver(function () {
        if (ins.childNodes.length || holder.querySelector("iframe,video")) {
          slot.classList.add("filled");
          mo.disconnect();
        }
      });
      mo.observe(holder, { childList: true, subtree: true });
    } else {
      slot.classList.add("filled");
    }
  }

  var observer = null;
  function getObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        observer.unobserve(e.target);
        enqueue(function () { loadOutstream(e.target); });
      });
    }, { rootMargin: LAZY_MARGIN });
    return observer;
  }

  var placed = 0;

  function add(slot) {
    if (!slot || slot.__adQueued) return false;
    if (placed >= MAX_OUTSTREAM) {
      if (slot.parentNode) slot.parentNode.removeChild(slot);
      return false;
    }
    slot.__adQueued = true;
    placed++;
    if (!slot.querySelector(".page-ad-holder")) {
      var h = document.createElement("div");
      h.className = "page-ad-holder";
      slot.appendChild(h);
    }
    if ("IntersectionObserver" in window) getObserver().observe(slot);
    else enqueue(function () { loadOutstream(slot); });
    return true;
  }

  function create() {
    var d = document.createElement("div");
    d.className = "page-ad";
    d.innerHTML = '<div class="page-ad-holder"></div>';
    return d;
  }

  // after every Nth element matching the selector, until the limit is reached
  function inject(selector, every) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      if (placed >= MAX_OUTSTREAM) break;
      if ((i + 1) % every === 0 && nodes[i].parentNode) {
        var slot = create();
        nodes[i].parentNode.insertBefore(slot, nodes[i].nextSibling);
        add(slot);
      }
    }
  }

  function addBottom() {
    var slot = create();
    slot.className += " page-ad-bottom";
    document.body.appendChild(slot);
    add(slot);
  }

  window.AdSlots = { add: add, create: create, inject: inject };

  function init() {
    addStyles();
    ensureLibrary();
    scheduleSliders();

    // outstream placement: manual slot > inject > bottom of page
    var slots = document.querySelectorAll("[data-ad-slot]");
    for (var i = 0; i < slots.length; i++) add(slots[i]);

    var b = document.body;
    var sel = b.getAttribute("data-ad-inject");
    if (sel && placed < MAX_OUTSTREAM) {
      var every = parseInt(b.getAttribute("data-ad-every"), 10) || DEFAULT_EVERY;
      inject(sel, Math.max(every, 3));
    }

    if (placed === 0) addBottom();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();