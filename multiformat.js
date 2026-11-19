(function () {
  "use strict";

  var SDK_PATH = "/js/sdk.js";
  var ZONE = "6093726";
  var INS_CLASS = "eas6a97888e38";

  // Load the ad library once, through your worker
  window.AdProvider = window.AdProvider || [];
  if (!document.querySelector('script[src="' + SDK_PATH + '"]')) {
    var s = document.createElement("script");
    s.async = true;
    s.type = "application/javascript";
    s.src = SDK_PATH;
    document.head.appendChild(s);
  }

  function place() {
    // Use the script's own position, or a [data-ad-slot] if the page has one
    var slot = document.querySelector("[data-ad-slot]");
    var box = document.createElement("div");
    box.className = "page-ad";
    box.style.cssText = "display:flex;justify-content:center;margin:24px auto;min-height:100px;";

    var ins = document.createElement("ins");
    ins.className = INS_CLASS;
    ins.setAttribute("data-zoneid", ZONE);
    box.appendChild(ins);

    if (slot) slot.appendChild(box);
    else document.body.appendChild(box); // default: end of the page

    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", place);
  } else {
    place();
  }
})();