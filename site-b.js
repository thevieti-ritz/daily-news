(function () {
  var me = document.currentScript;
  if (!me) return;

  // Create the ad slot right where the script tag sits on the page
  var slot = document.createElement("ins");
  slot.className = "eas6a97888e31";
  slot.setAttribute("data-zoneid", "5980730");
  me.parentNode.insertBefore(slot, me);

  // Load the ad library through your own domain (only once per page)
  if (!window.__adLibLoaded) {
    window.__adLibLoaded = true;
    var lib = document.createElement("script");
    lib.async = true;
    lib.type = "application/javascript";
    lib.src = "/js/sdk.js";
    document.head.appendChild(lib);
  }

  // Ask for the ad
  (window.AdProvider = window.AdProvider || []).push({ serve: {} });
})();