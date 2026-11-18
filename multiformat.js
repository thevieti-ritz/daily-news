(function () {
  "use strict";
  var SDK_PATH = "/js/sdk.js";       // magsrv library via your worker (same as site-a.js)
  var ZONE = "6093726";
  var INS_CLASS = "eas6a97888e38";

  function init() {
    if (document.querySelector('ins[data-zoneid="' + ZONE + '"]')) return;

    window.AdProvider = window.AdProvider || [];

    // Load the library only if site-a.js (or anything else) hasn't already
    if (!window.__adLibLoaded &&
        !document.querySelector('script[src="' + SDK_PATH + '"]')) {
      window.__adLibLoaded = true;
      var s = document.createElement("script");
      s.async = true;
      s.type = "application/javascript";
      s.src = SDK_PATH;
      document.head.appendChild(s);
    }

    var ins = document.createElement("ins");
    ins.className = INS_CLASS;
    ins.setAttribute("data-zoneid", ZONE);
    document.body.appendChild(ins);

    window.AdProvider.push({ serve: {} });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();