(function () {
  var ZONE_ID = "6093726";
  var INS_CLASS = "eas6a97888e38";
  var PROVIDER_SRC = "/js/sdk.js"; // proxied by your worker

  function init() {
    var slots = document.querySelectorAll("[data-ad-slot]");
    if (!slots.length) return;

    // Load the provider library once
    if (!document.querySelector("script[data-ad-provider]")) {
      var s = document.createElement("script");
      s.async = true;
      s.type = "application/javascript";
      s.src = PROVIDER_SRC;
      s.setAttribute("data-ad-provider", "1");
      document.head.appendChild(s);
    }

    window.AdProvider = window.AdProvider || [];

    slots.forEach(function (slot) {
      if (slot.getAttribute("data-ad-loaded")) return;
      slot.setAttribute("data-ad-loaded", "1");

      var ins = document.createElement("ins");
      ins.className = INS_CLASS;
      ins.setAttribute("data-zoneid", slot.getAttribute("data-zoneid") || ZONE_ID);
      slot.appendChild(ins);

      window.AdProvider.push({ serve: {} });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();