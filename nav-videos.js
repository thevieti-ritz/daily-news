// nav-videos.js
// 1) Puts a bold "Watch Videos" banner at the very top of the page.
// 2) Adds a "Videos" link to the side menu and the phone bottom bar (if the page has them).
// Safe to load on every page. To change the banner text or colours, edit the SETTINGS below.
(function () {
  // ---------------- SETTINGS ----------------
  var URL = "videos.html";
  var TEXT = "WATCH VIDEOS \u2014 TikTok style";
  var BADGE = "NEW";
  var BAR_HEIGHT = 42;                                   // banner height in px
  var BAR_BG = "linear-gradient(90deg,#e63946,#f4a522)"; // banner colours
  // ------------------------------------------

  var path = location.pathname.toLowerCase();
  var onVideosPage = /\/videos(\.html)?$/.test(path);

  function addBanner() {
    if (onVideosPage || document.getElementById("dnVideosBar")) return;

    var st = document.createElement("style");
    st.textContent =
      "#dnVideosBar{position:fixed;top:0;left:0;right:0;height:" + BAR_HEIGHT + "px;z-index:100000;" +
      "display:flex;align-items:center;justify-content:center;gap:10px;background:" + BAR_BG + ";" +
      "color:#fff!important;text-decoration:none!important;font-family:'Nunito',system-ui,sans-serif;" +
      "font-weight:900;font-size:15px;letter-spacing:.4px;text-shadow:0 1px 3px rgba(0,0,0,.35);" +
      "box-shadow:0 2px 10px rgba(0,0,0,.45);cursor:pointer;white-space:nowrap;overflow:hidden;padding:0 10px}" +
      "#dnVideosBar:active{filter:brightness(.92)}" +
      "#dnVideosBar .dn-play{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;" +
      "background:#fff;color:#e63946;font-size:11px;padding-left:2px;text-shadow:none}" +
      "#dnVideosBar .dn-badge{background:#000;color:#ffea00;font-size:11px;font-weight:900;padding:3px 8px;" +
      "border-radius:999px;animation:dnPulse 1.4s ease-in-out infinite;text-shadow:none}" +
      "#dnVideosBar .dn-arrow{font-size:20px;line-height:1}" +
      "@keyframes dnPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}" +
      "@media(max-width:380px){#dnVideosBar{font-size:13px;gap:7px}}";
    document.head.appendChild(st);

    var bar = document.createElement("a");
    bar.id = "dnVideosBar";
    bar.href = URL;
    bar.innerHTML =
      '<span class="dn-play">\u25B6</span><span>' + TEXT + '</span>' +
      '<span class="dn-badge">' + BADGE + '</span><span class="dn-arrow">\u203A</span>';
    document.body.insertBefore(bar, document.body.firstChild);

    // Make room: push the page down, and move anything stuck to the top of the screen
    // (like a fixed top bar or the side menu) down by the same amount.
    var pad = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    var kids = Array.prototype.slice.call(document.body.children);
    var moves = [];
    kids.forEach(function (el) {
      if (el === bar) return;
      var cs = getComputedStyle(el);
      if ((cs.position === "fixed" || cs.position === "sticky") && cs.top !== "auto") {
        var t = parseFloat(cs.top);
        if (!isNaN(t) && t <= 120) moves.push([el, t]);
      }
    });
    document.body.style.paddingTop = (pad + BAR_HEIGHT) + "px";
    moves.forEach(function (m) { m[0].style.top = (m[1] + BAR_HEIGHT) + "px"; });
  }

  function addMenuLinks() {
    // Side menu (the slide-out menu)
    var side = document.querySelector(".side-nav");
    if (side && !side.querySelector('a[href="' + URL + '"]')) {
      var a = document.createElement("a");
      a.href = URL;
      a.className = "side-link";
      a.innerHTML = '<i class="fas fa-clapperboard"></i> Videos';
      var home = side.querySelector('a.side-link[href="index.html"]');
      if (home && home.nextSibling) home.parentNode.insertBefore(a, home.nextSibling);
      else side.appendChild(a);
    }

    // Phone bottom bar
    var bottom = document.querySelector(".bottom-nav");
    if (bottom && !bottom.querySelector('a[href="' + URL + '"]')) {
      var b = document.createElement("a");
      b.href = URL;
      b.className = "bottom-nav-item";
      b.innerHTML = '<i class="fas fa-circle-play"></i>Videos';
      var first = bottom.querySelector("a.bottom-nav-item");
      if (first && first.nextSibling) first.parentNode.insertBefore(b, first.nextSibling);
      else bottom.appendChild(b);
    }
  }

  function run() { addMenuLinks(); addBanner(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
