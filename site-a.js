/* ============================================
   site-a.js — ExoClick ad slots (clean version)

   Ad: zone 5993834, class eas6a97888e37
   Rule: maximum 10 ad slots per page. Only those slots ever
   get an ad tag and only those slots ask for an ad.
   Each slot asks ONCE. No retries, no refresh.

   HOW TO USE
   1) In <head> add:   <script src="/site-a.js" defer></script>
      (do NOT add the ExoClick ad-provider.js script yourself,
       this file loads it for you)
   2) Where you want an ad, put an empty div:
        <div class="page-ad" data-ad-slot></div>
   3) Optional: auto-insert ads inside an article. On <body> add:
        data-ad-inject="#articleBody p"  data-ad-every="3"
        (an ad after every 3rd paragraph)
   ============================================ */
(function () {
  "use strict";

  // ---------- settings ----------
  var ZONE_ID   = "5993834";
  var AD_CLASS  = "eas6a97888e37";
  var LIB_URL   = "https://a.magsrv.com/ad-provider.js";
  var MAX_SLOTS = 10;      // hard limit of ad slots per page

  var slotCount = 0;       // slots accepted so far

  // ---------- styles ----------
  function addStyles() {
    var st = document.createElement("style");
    st.textContent =
      ".page-ad{display:flex;justify-content:center;align-items:flex-start;" +
      "width:100%;max-width:100%;min-height:250px;margin:20px auto;overflow:hidden}" +
      ".page-ad-holder{width:100%;max-width:640px;margin:0 auto}" +
      ".page-ad-holder>ins~ins{display:none!important}"; // never show a 2nd ad in a slot
    document.head.appendChild(st);
  }

  // ---------- load the ExoClick library once ----------
  function loadLibrary() {
    window.AdProvider = window.AdProvider || [];
    if (document.querySelector('script[src*="ad-provider.js"]')) return;
    var s = document.createElement("script");
    s.async = true;
    s.type = "application/javascript";
    s.src = LIB_URL;
    document.head.appendChild(s);
  }

  // ---------- request ONE ad for ONE slot ----------
  function requestAd(slot) {
    if (slot.__adAsked) return;          // already asked, never again
    slot.__adAsked = true;

    var holder = document.createElement("div");
    holder.className = "page-ad-holder";
    holder.innerHTML =
      '<ins class="' + AD_CLASS + '" data-zoneid="' + ZONE_ID + '"></ins>';
    slot.appendChild(holder);

    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }

  // ---------- accept a slot (only the first 10) ----------
  function addSlot(slot) {
    if (slot.__adCounted) return;
    if (slotCount >= MAX_SLOTS) {
      // over the limit: remove the empty slot, no ad tag, no request
      if (slot.parentNode) slot.parentNode.removeChild(slot);
      return;
    }
    slot.__adCounted = true;
    slotCount++;
    requestAd(slot);
  }

  // ---------- optional: insert slots inside an article ----------
  function inject(selector, every) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      if (slotCount >= MAX_SLOTS) break;
      if ((i + 1) % every === 0 && nodes[i].parentNode) {
        var slot = document.createElement("div");
        slot.className = "page-ad";
        slot.setAttribute("data-ad-slot", "");
        nodes[i].parentNode.insertBefore(slot, nodes[i].nextSibling);
        addSlot(slot);
      }
    }
  }

  // Use this from other scripts (e.g. when you add cards dynamically):
  //   var el = document.createElement("div"); el.className = "page-ad";
  //   container.appendChild(el); AdSlots.add(el);
  window.AdSlots = { add: addSlot };

  // ---------- start ----------
  function init() {
    addStyles();
    loadLibrary();

    var sel = document.body.getAttribute("data-ad-inject");
    if (sel) {
      var every = parseInt(document.body.getAttribute("data-ad-every"), 10) || 2;
      inject(sel, every);
    }

    var slots = document.querySelectorAll("[data-ad-slot]");
    for (var i = 0; i < slots.length; i++) addSlot(slots[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();