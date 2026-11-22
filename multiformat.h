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

  function isHomePage() {
    var p = window.location.pathname;
    return p === "/" || p === "" || /\/index\.html?$/i.test(p);
  }

  function buildAd() {
    var box = document.createElement("div");
    box.className = "page-ad";
    box.style.cssText = "display:flex;justify-content:center;margin:24px auto;min-height:100px;";

    var ins = document.createElement("ins");
    ins.className = INS_CLASS;
    ins.setAttribute("data-zoneid", ZONE);
    box.appendChild(ins);
    return box;
  }

  function serve() {
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }

  function place() {
    if (isHomePage()) {
      // Home page: ad at the very top of the page
      document.body.insertBefore(buildAd(), document.body.firstChild);
      serve();
      return;
    }

    // Other pages: only render inside designated ad slots
    var slots = document.querySelectorAll("[data-ad-slot]");
    for (var i = 0; i < slots.length; i++) {
      slots[i].appendChild(buildAd());
      serve(); // one serve call per ad unit
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", place);
  } else {
    place();
  }
})();