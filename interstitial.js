(function () {
  "use strict";
  var SDK_PATH = "/js/sdk2.js";      // pemsrv library via the worker
  var ZONE = "6093648";
  var INS_CLASS = "eas6a97888e35";

  function init() {
    if (document.querySelector('ins[data-zoneid="' + ZONE + '"]')) return;

    window.AdProvider = window.AdProvider || [];

    if (!window.__adLib2Loaded) {
      window.__adLib2Loaded = true;
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