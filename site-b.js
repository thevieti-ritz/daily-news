(function () {
  var me = document.currentScript;
  if (!me) return;

  // 1. Create the ad container tag right where this script sits
  var slot = document.createElement("ins");
  slot.className = "eas6a97888e31";
  slot.setAttribute("data-zoneid", "5980730");
  me.parentNode.insertBefore(slot, me);

  // Helper function to request the ad once SDK is active
  function requestAd() {
    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ serve: {} });
  }

  // 2. Load the ad library through your worker endpoint (only once per page)
  if (!window.__adLibLoaded) {
    window.__adLibLoaded = true;

    var lib = document.createElement("script");
    lib.async = true;
    lib.type = "application/javascript";
    lib.src = "/js/sdk.js"; // Loads through Cloudflare worker route

    // Trigger ad request ONLY after the script has fully executed
    lib.onload = function() {
      requestAd();
    };

    document.head.appendChild(lib);
  } else {
    // If the library was already loaded by a previous ad unit on the page, request immediately
    requestAd();
  }
})();