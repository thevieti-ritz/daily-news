(function () {
  "use strict";
  var SDK_PATH = "/js/sdk.js"; // magsrv library via your worker (same as site-a.js)
  var ZONE = "6093726";
  var INS_CLASS = "eas6a97888e38";
  var W = 350;
  var H = 200;

  function addStyles() {
    if (document.getElementById("sticky-banner-css")) return;
    var st = document.createElement("style");
    st.id = "sticky-banner-css";
    st.textContent =
      "#sticky-banner-ad{position:fixed;left:50%;bottom:0;transform:translateX(-50%);" +
      "width:" + W + "px;height:" + H + "px;max-width:100vw;z-index:9000;" +
      "background:#000;overflow:hidden;box-shadow:0 -2px 12px rgba(0,0,0,.35);" +
      "padding-bottom:env(safe-area-inset-bottom,0);}" +
      "#sticky-banner-ad ins{display:block;width:" + W + "px;height:" + H + "px;" +
      "max-width:100%;margin:0 auto;overflow:hidden;}";
    document.head.appendChild(st);
  }

  // On pages with the mobile bottom nav, sit just above it
  function positionAboveNav(box) {
    var nav = document.querySelector(".bottom-nav");
    var offset = 0;
    if (nav && getComputedStyle(nav).display !== "none") {
      offset = nav.offsetHeight || 56;
    }
    box.style.bottom = offset + "px";
    // keep page content from being hidden behind the banner
    document.body.style.paddingBottom = H + offset + "px";
  }

  function init() {
    if (document.querySelector('ins[data-zoneid="' + ZONE + '"]')) return;

    window.AdProvider = window.AdProvider || [];

    // Load the library only if site-a.js (or anything else) hasn't already
    if (
      !window.__adLibLoaded &&
      !document.querySelector('script[src="' + SDK_PATH + '"]')
    ) {
      window.__adLibLoaded = true;
      var s = document.createElement("script");
      s.async = true;
      s.type = "application/javascript";
      s.src = SDK_PATH;
      document.head.appendChild(s);
    }

    addStyles();

    var box = document.createElement("div");
    box.id = "sticky-banner-ad";

    var ins = document.createElement("ins");
    ins.className = INS_CLASS;
    ins.setAttribute("data-zoneid", ZONE);
    box.appendChild(ins);
    document.body.appendChild(box);

    positionAboveNav(box);
    window.addEventListener("resize", function () {
      positionAboveNav(box);
    });

    window.AdProvider.push({ serve: {} });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();