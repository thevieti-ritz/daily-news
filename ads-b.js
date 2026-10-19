/* ============================================
   ads-b.js — second ad set, zone 5980730
   Add  <script src="/ads-b.js?v=1" defer></script>  to any page that should show it.
   Standalone: does not depend on ads.js.
   ============================================ */
(function () {
  "use strict";

  var ZONE = "5980730";
  var INS_CLASS = "eas6a97888e31";

  function run() {
    // 1) load the ad library once (skipped if ads.js or the page already loaded it)
    window.AdProvider = window.AdProvider || [];
    if (!document.querySelector('script[src*="ad-provider.js"]')) {
      var s = document.createElement("script");
      s.async = true;
      s.type = "application/javascript";
      s.src = "https://a.magsrv.com/ad-provider.js";
      document.head.appendChild(s);
    }

    // 2) add the ad tag to the page, once
    if (document.querySelector('ins[data-zoneid="' + ZONE + '"]')) return;
    var ins = document.createElement("ins");
    ins.className = INS_CLASS;
    ins.setAttribute("data-zoneid", ZONE);
    document.body.appendChild(ins);

    // 3) ask the library to serve it
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();