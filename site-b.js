(function () {
  var me = document.currentScript;
  if (!me) return;

  // 1. Create the ad container where this script sits
  var slot = document.createElement("ins");
  slot.style.display = "block";
  me.parentNode.insertBefore(slot, me);

  function triggerServe() {
    slot.className = "eas6a97888e31";
    slot.setAttribute("data-zoneid", "5980730");
    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ serve: {} });
  }

  // 2. Load the ad library through your Worker (only once per page)
  if (!window.__adLibLoaded) {
    window.__adLibLoaded = true;
    var lib = document.createElement("script");
    lib.async = true;
    lib.type = "application/javascript";
    lib.src = "/js/sdk.js";
    lib.onload = triggerServe;
    document.head.appendChild(lib);
  } else {
    triggerServe();
  }
})();