/* ============================================
   instant-message.js — ExoClick instant message zone

   Zone 6104538 (class eas6a97888e6). Loaded once per page.
   Instant messages place themselves, so no ad slot is needed.

   Works together with worker.js:
     - SDK_PATH below must equal the SDK route in worker.js ("/js/sdk.js")
     - the worker route must cover /js/*  (e.g. yourdomain.com/js/*)
     - this file must be served from your site at /js/instant-message.js

   HOW TO USE ON A PAGE
     Add  <script src="/instant-message.js" defer></script>  once, in <body>
     (as ExoClick instructs; it also works in <head>)
     To skip a page:  <body data-no-instant-message>

   The ad is requested ONCE, as soon as the page has loaded (visible or not).
   If another ad script on the page (e.g. multiformat.js) is also starting,
   the two requests are kept MIN_GAP_MS apart.
   Nothing is retried or refreshed.
   ============================================ */
(function () {
  "use strict";

  var SDK_PATH = "/js/sdk.js"; // served by worker.js
  var ZONE = "6104538";
  var INS_CLASS = "eas6a97888e6";
  var MIN_GAP_MS = 1000; // gap between ad requests on the same page

  if (window.__instantMessageStarted) return;
  window.__instantMessageStarted = true;

  // the <script> tag that loaded this file (used to place the ad beside it)
  var me = document.currentScript;

  // ---------- load the ad library through our own domain (worker.js) ----------
  function ensureLibrary() {
    window.AdProvider = window.AdProvider || [];
    if (window.__adLibLoaded) return;
    window.__adLibLoaded = true;
    if (
      document.querySelector(
        'script[src*="ad-provider.js"], script[src="' + SDK_PATH + '"]',
      )
    )
      return;
    var s = document.createElement("script");
    s.async = true;
    s.type = "application/javascript";
    s.src = SDK_PATH;
    document.head.appendChild(s);
  }

  // ---------- ask for the ad once ----------
  function serve() {
    if (window.__instantMessageServed) return;
    if (document.body.hasAttribute("data-no-instant-message")) return;
    window.__instantMessageServed = true;

    ensureLibrary();

    var ins = document.createElement("ins");
    ins.className = INS_CLASS;
    ins.setAttribute("data-zoneid", ZONE);
    if (me && me.parentNode && document.body.contains(me)) {
      me.parentNode.insertBefore(ins, me.nextSibling); // script is in <body>: ad goes right after it
    } else {
      document.body.appendChild(ins); // script is in <head>: ad goes at the end of <body>
    }

    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }

  // ---------- keep requests apart when several ad scripts share a page ----------
  function scheduleServe() {
    var now = Date.now();
    var at = Math.max(now, window.__adNextAt || 0);
    window.__adNextAt = at + MIN_GAP_MS;
    setTimeout(serve, at - now);
  }

  // ---------- fire once the page has loaded, whether or not the tab is visible ----------
  if (document.readyState === "complete") scheduleServe();
  else window.addEventListener("load", scheduleServe);
})();
