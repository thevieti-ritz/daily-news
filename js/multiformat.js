/* ============================================
   multiformat.js — ExoClick multiformat zone

   Zone 6104540 (class eas6a97888e38). Loaded once per page.
   Multiformat zones place themselves, so no ad slot is needed.

   Works together with worker.js:
     - SDK_PATH below must equal the SDK route in worker.js ("/js/sdk.js")
     - the worker route must cover /js/*  (e.g. yourdomain.com/js/*)
     - this file must be served from your site at /js/multiformat.js

   HOW TO USE ON A PAGE
     Add  <script src="/multiformat.js" defer></script>  in <head>
     To skip a page:  <body data-no-multiformat>

   The ad is requested ONCE, only while the tab is visible.
   Nothing is retried or refreshed.
   ============================================ */
(function () {
  "use strict";

  var SDK_PATH = "/js/sdk.js"; // served by worker.js
  var ZONE = "6104540";
  var INS_CLASS = "eas6a97888e38";

  if (window.__multiformatStarted) return;
  window.__multiformatStarted = true;

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
    if (window.__multiformatServed) return;
    if (document.body.hasAttribute("data-no-multiformat")) return;
    window.__multiformatServed = true;

    ensureLibrary();

    var ins = document.createElement("ins");
    ins.className = INS_CLASS;
    ins.setAttribute("data-zoneid", ZONE);
    document.body.appendChild(ins);

    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }

  // ---------- only fire while the tab is visible ----------
  function start() {
    if (document.visibilityState === "hidden") {
      document.addEventListener("visibilitychange", function onVis() {
        if (document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", onVis);
          serve();
        }
      });
    } else {
      serve();
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
