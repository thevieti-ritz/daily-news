/* ============================================================
   intro.js  -  INTRO VIDEO LAYER + VAST AD (one file for ALL pages)
   Add this ONE line right after <body> on every page:
       <script src="/intro.js"></script>
   Edit the SETTINGS below, upload to GitHub, and every page updates.
   ============================================================ */
(function () {

    /* ---------------- SETTINGS ---------------- */
    var INTRO_VIDEO_URL   = "https://pub-947189f89d8c4deba38620dab133e00a.r2.dev/No_Copyright_Video%2C_Background%2C_Green_Screen%2C_Motion_Graphics%2C_Animated_Background%2C_Copyright_Free(480p).mp4"; // 1) your video link
    var CLOSE_AFTER_SECS  = 25;    // 2) layer closes this many seconds after Play is clicked
    var REPEAT_AFTER_MINUTES = 3;  // 3) each page shows the intro at most once per this many minutes (0 = every page load)
    var INTRO_POSTER      = "";    // 4) optional picture shown before play (image link), or leave empty
    var AD_TAG_URL        = "/media/feed.xml"; // 5) your Cloudflare Worker route (same domain). Empty "" = no ad
    var AD_SKIP_AFTER_SECS = 5;    // 6) skip button delay if the VAST doesn't specify one (0 = no skip button)
    var AD_START_TIMEOUT  = 20000; // 7) ms after the tap to wait for the ad to start before falling back to your video
    var AD_WAIT_MAX       = 20000; // 8) MAX ms Play stays locked in total (ad request + buffering). After this your video plays instead
    var AD_PRELOAD        = true;  // 9) true = download the ad video while the visitor looks at the page, so it starts instantly
    var AD_BUFFER_WAIT    = 6000;  // 10) extra ms to let the ad video buffer before unlocking Play anyway (iPhones ignore preloading)
    var AD_RETRIES        = 2;     // 11) extra tries when the ad server answers with no ad (0 = no retries)
    /* ------------------------------------------ */

  var CSS = `
    #introLayer{position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;transition:opacity .4s ease}
    #introLayer.intro-hide{opacity:0;pointer-events:none}
    #introWrap{position:relative;width:100%;max-width:900px;max-height:100%;aspect-ratio:16/9;background:#000}
    #introVideo{width:100%;height:100%;display:block;background:#000;object-fit:contain}
    #introPlay{position:absolute;inset:0;margin:auto;width:84px;height:84px;border:none;border-radius:50%;background:#e63946;color:#fff;font-size:34px;line-height:84px;padding:0 0 0 6px;cursor:pointer;box-shadow:0 6px 24px rgba(230,57,70,.55)}
    #introPlay:active{transform:scale(.94)}
    #introMsg{position:absolute;left:0;right:0;bottom:64px;text-align:center;color:#fff;font:600 14px system-ui,sans-serif;text-shadow:0 1px 4px #000;padding:0 12px;pointer-events:none}
    #introCount{position:fixed;top:calc(12px + env(safe-area-inset-top));right:14px;background:rgba(0,0,0,.65);color:#fff;font:700 13px system-ui,sans-serif;padding:7px 12px;border-radius:20px}
    #introAdTag{position:absolute;left:10px;top:10px;background:rgba(0,0,0,.65);color:#fff;font:700 12px system-ui,sans-serif;padding:5px 10px;border-radius:14px;pointer-events:none}
    #introSkip{position:absolute;right:10px;bottom:14px;background:rgba(0,0,0,.75);color:#fff;border:1px solid rgba(255,255,255,.5);font:700 13px system-ui,sans-serif;padding:9px 14px;border-radius:4px;cursor:pointer}
    #introSkip[disabled]{opacity:.7;cursor:default}
    .intro-hidden{display:none!important}
    body.intro-lock{overflow:hidden}
  
`;
  var HTML = `
  <div id="introLayer" role="dialog" aria-label="Welcome video" style="position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:#000;z-index:2147483647">
    <div id="introWrap">
      <video id="introVideo" controls playsinline preload="metadata" controlsList="nodownload noremoteplayback"></video>
      <button id="introPlay" aria-label="Play video">&#9654;</button>
      <div id="introAdTag" class="intro-hidden">Ad</div>
      <button id="introSkip" class="intro-hidden"></button>
      <div id="introMsg"></div>
    </div>
    <div id="introCount" class="intro-hidden"></div>
  </div>

  
`;

  function log() { try { console.log.apply(console, ["[intro]"].concat([].slice.call(arguments))); } catch (e) {} }
  var seenAlready = false, seenKey = "introShown:" + location.pathname;
  if (REPEAT_AFTER_MINUTES > 0) {
    try {
      var lastShown = +localStorage.getItem(seenKey) || 0;
      seenAlready = !!lastShown && (Date.now() - lastShown) < REPEAT_AFTER_MINUTES * 60000;
      if (!seenAlready) localStorage.setItem(seenKey, String(Date.now()));   // remember when this page last showed the intro
    } catch (e) {}
  }
  // other scripts on the page can read this flag (true while the intro is showing) and listen for the "introclosed" event
  if (!seenAlready) { window.__introActive = true; }

  function init() {
    if (seenAlready) { return; }

    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var holder = document.createElement("div"); holder.innerHTML = HTML;
    while (holder.lastChild) { document.body.insertBefore(holder.lastChild, document.body.firstChild); }

    var layer = document.getElementById("introLayer");
    var v = document.getElementById("introVideo"),
        playBtn = document.getElementById("introPlay"),
        msg = document.getElementById("introMsg"),
        cnt = document.getElementById("introCount"),
        adTag = document.getElementById("introAdTag"),
        skipBtn = document.getElementById("introSkip"),
        main = document.getElementById("mainContent"),
        started = false, closed = false, retries = 0, endAt = 0, tick = null;

    /* ---------- ad state ---------- */
    var mode = "content";            // "ad" while the ad is playing
    var ad = { ready: false, media: "", imp: [], trk: {}, prog: [], click: "", clickTrk: [], skip: -1, fired: {}, watchdog: null };

    document.body.classList.add("intro-lock");
    if (main) main.setAttribute("inert", "");
    if (INTRO_POSTER) v.poster = INTRO_POSTER;

    function close() {
      if (closed) return; closed = true;
      clearInterval(tick);
      try { v.pause(); } catch (e) {}
      layer.classList.add("intro-hide");
      document.body.classList.remove("intro-lock");
      if (main) main.removeAttribute("inert");
      cnt.classList.add("intro-hidden");
      setTimeout(function () {
        layer.remove(); cnt.remove();
        window.__introActive = false;
        try { document.dispatchEvent(new Event("introclosed")); } catch (e) {}
      }, 450);
    }

    function startClock() {
      if (started) return; started = true;
      cnt.classList.remove("intro-hidden");
      endAt = Date.now() + CLOSE_AFTER_SECS * 1000;
      function update() {
        var left = Math.ceil((endAt - Date.now()) / 1000);
        if (left <= 0) { close(); return; }
        cnt.textContent = "Site opens in " + left + "s";
      }
      update(); tick = setInterval(update, 250);
    }

    function load(bust) {
      v.src = bust ? INTRO_VIDEO_URL + (INTRO_VIDEO_URL.indexOf("?") > -1 ? "&" : "?") + "r=" + Date.now() : INTRO_VIDEO_URL;
      v.load();
    }

    function tryPlay() {
      msg.textContent = "";
      var p = v.play();
      if (p && p.catch) p.catch(function () { msg.textContent = "Tap the play button again."; playBtn.classList.remove("intro-hidden"); });
    }

    /* =====================  VAST PRE-ROLL  ===================== */
    function ping(url) { try { new Image().src = url.replace("[TIMESTAMP]", Date.now()).replace("[CACHEBUSTING]", Math.random().toString().slice(2)); } catch (e) {} }
    function fire(ev) {
      if (ad.fired[ev]) return; ad.fired[ev] = 1;
      (ev === "impression" ? ad.imp : (ad.trk[ev] || [])).forEach(ping);
    }
    function txt(n) { return n ? (n.textContent || "").trim() : ""; }
    function toSecs(s) { var p = (s || "").split(":"); return p.length === 3 ? (+p[0]) * 3600 + (+p[1]) * 60 + parseFloat(p[2]) : -1; }

    function loadVast(url, depth) {
      return fetch(url, { credentials: "omit" }).then(function (r) { return r.text(); }).then(function (t) {
        var doc = new DOMParser().parseFromString(t, "text/xml");
        var node = doc.querySelector("Ad > InLine") || doc.querySelector("Ad > Wrapper");
        if (!node) throw new Error("no ad");
        [].forEach.call(node.querySelectorAll("Impression"), function (n) { ad.imp.push(txt(n)); });
        [].forEach.call(node.querySelectorAll("Tracking"), function (n) {
          var e = n.getAttribute("event");
          if (e === "progress") { ad.prog.push({ off: n.getAttribute("offset") || "", url: txt(n), done: false }); return; }
          (ad.trk[e] = ad.trk[e] || []).push(txt(n));
        });
        [].forEach.call(node.querySelectorAll("ClickTracking"), function (n) { ad.clickTrk.push(txt(n)); });
        var ct = node.querySelector("ClickThrough"); if (ct && !ad.click) ad.click = txt(ct);
        var lin = node.querySelector("Linear");
        if (lin && lin.getAttribute("skipoffset")) {
          var so = lin.getAttribute("skipoffset");
          ad.skip = so.indexOf("%") > -1 ? -2 - parseFloat(so) / 100 : toSecs(so);   // -2-x = percentage, resolved later
        }
        if (node.tagName === "Wrapper") {
          var next = txt(node.querySelector("VASTAdTagURI"));
          if (!next || depth >= 3) throw new Error("wrapper end");
          return loadVast(next, depth + 1);
        }
        // pick the best progressive MP4 (largest up to 1280px wide)
        var files = [].filter.call(node.querySelectorAll("MediaFile"), function (m) {
          var type = (m.getAttribute("type") || "").toLowerCase(), d = (m.getAttribute("delivery") || "progressive").toLowerCase();
          return d === "progressive" && (type.indexOf("mp4") > -1 || /\.mp4(\?|$)/i.test(txt(m)));
        });
        if (!files.length) throw new Error("no mp4");
        files.sort(function (a, b) {
          var wa = +a.getAttribute("width") || 0, wb = +b.getAttribute("width") || 0;
          var ra = wa > 1280 ? -wa : wa, rb = wb > 1280 ? -wb : wb;
          return rb - ra;
        });
        ad.media = txt(files[0]);
        ad.ready = !!ad.media;
        log("ad ready:", ad.media);
      });
    }

    function endAd() {
      if (mode !== "ad") return;
      mode = "content";
      clearTimeout(ad.watchdog);
      adTag.classList.add("intro-hidden"); skipBtn.classList.add("intro-hidden");
      v.controls = true;
      msg.textContent = "";
      load(false); tryPlay();
    }

    function playAd() {
      mode = "ad";
      v.controls = false;
      if (!ad.preloaded) { v.src = ad.media; v.load(); }   // already downloading? just press play
      adTag.classList.remove("intro-hidden");
      ad.watchdog = setTimeout(function () { if (mode === "ad" && !ad.fired.start) { log("ad did not start in time, playing your video"); endAd(); } }, AD_START_TIMEOUT);
      tryPlay();
    }

    function adTimeUpdate() {
      if (mode !== "ad" || !v.duration) return;
      var t = v.currentTime, d = v.duration, pct = t / d;
      if (pct >= .25) fire("firstQuartile");
      if (pct >= .5)  fire("midpoint");
      if (pct >= .75) fire("thirdQuartile");
      ad.prog.forEach(function (p) {
        if (p.done) return;
        var at = p.off.indexOf("%") > -1 ? parseFloat(p.off) / 100 * d : toSecs(p.off);
        if (at >= 0 && t >= at) { p.done = true; ping(p.url); }
      });
      var skipAt = ad.skip <= -2 ? (-(ad.skip + 2)) * d : (ad.skip >= 0 ? ad.skip : AD_SKIP_AFTER_SECS);
      if (skipAt >= d - 1) { skipBtn.classList.add("intro-hidden"); return; }   // skip point is after the ad ends: no button
      if (skipAt > 0 || ad.skip === 0) {
        skipBtn.classList.remove("intro-hidden");
        if (t >= skipAt) { skipBtn.disabled = false; skipBtn.textContent = "Skip Ad \u25B6"; }
        else { skipBtn.disabled = true; skipBtn.textContent = "Skip in " + Math.ceil(skipAt - t) + "s"; }
      }
    }

    var onSkip = function () { if (skipBtn.disabled) return; fire("skip"); endAd(); };
    skipBtn.addEventListener("click", onSkip);
    v.addEventListener("timeupdate", adTimeUpdate);

    // prefetch the VAST now so playback can begin synchronously inside the user's tap
    // ask again if the ad server answers with no ad (a fresh request each time)
    function resetAd() { ad.imp = []; ad.trk = {}; ad.prog = []; ad.click = ""; ad.clickTrk = []; ad.skip = -1; ad.media = ""; ad.ready = false; }
    function fetchAd(n) {
      resetAd();
      return loadVast(AD_TAG_URL, 0).catch(function (err) {
        if (n < AD_RETRIES && !started && !closed) {
          log("no ad (" + ((err && err.message) || err) + "), asking again " + (n + 1) + "/" + AD_RETRIES);
          return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return fetchAd(n + 1); });
        }
        throw err;
      });
    }

    // start downloading the ad video right away; Play unlocks once enough is buffered
    function preloadAd() {
      ad.preloaded = true; v.controls = false;
      v.preload = "auto"; v.src = ad.media; v.load();
      adTag.classList.remove("intro-hidden");
      var bufTimer = setTimeout(function () { openGate("ad video still buffering, unlocked anyway"); }, AD_BUFFER_WAIT);
      v.addEventListener("canplay", function onCan() {
        v.removeEventListener("canplay", onCan); clearTimeout(bufTimer);
        log("ad video buffered"); openGate("ad video buffered");
      });
      v.addEventListener("error", function onErr() {
        if (mode === "ad" || ad.fired.start) return;          // errors during/after the ad are handled elsewhere
        v.removeEventListener("error", onErr); clearTimeout(bufTimer);
        ad.ready = false; ad.preloaded = false; adTag.classList.add("intro-hidden");
        log("ad video preload failed, using your video"); load(false); openGate("ad video failed");
      });
    }

    // Play stays locked until the ad is ready (or AD_WAIT_MAX passes), so the ad is never skipped by tapping too early
    var gateTimer = null, gateOpen = true;
    function openGate(why) {
      if (gateOpen) return; gateOpen = true; clearTimeout(gateTimer);
      playBtn.disabled = false; playBtn.style.opacity = "";
      if (msg.textContent === "Loading\u2026") msg.textContent = "";
      if (!ad.ready) v.controls = true;
      log("Play unlocked:", why);
    }
    if (AD_TAG_URL) {
      gateOpen = false; v.controls = false;
      playBtn.disabled = true; playBtn.style.opacity = ".55"; msg.textContent = "Loading\u2026";
      gateTimer = setTimeout(function () { openGate("waited " + (AD_WAIT_MAX / 1000) + "s, ad not ready"); }, AD_WAIT_MAX);
      fetchAd(0)
        .then(function () {
          if (started) {                         // ad came late: the ad wins, it takes over from your video
            if (closed) return;
            ad.adDone = true; log("ad arrived after Play was tapped - playing it now");
            playAd(); return;
          }
          if (AD_PRELOAD && ad.ready) { preloadAd(); } else { openGate("ad ready"); }
        })
        .catch(function (err) { ad.ready = false; log("NO AD:", (err && err.message) ? err.message : err); openGate("no ad available"); });
    }
    /* ========================================================== */

    var onPlay = function () {
      startClock(); playBtn.classList.add("intro-hidden");
      if (AD_TAG_URL && !ad.ready && !ad.adDone) log("Play tapped but the ad was not ready, so your video plays instead");
      if (mode === "content" && ad.ready && !ad.fired.start && !ad.adDone) { ad.adDone = true; playAd(); return; }
      v.controls = true;
      if (v.error) { load(true); }
      tryPlay();
    };
    playBtn.addEventListener("click", onPlay);

    v.addEventListener("play", function () {
      playBtn.classList.add("intro-hidden"); startClock();
      if (mode === "ad") { clearTimeout(ad.watchdog); fire("impression"); fire("start"); log("ad playing"); }
    });
    v.addEventListener("pause", function () { if (!closed && !v.ended) playBtn.classList.remove("intro-hidden"); });
    v.addEventListener("ended", function () {
      if (mode === "ad") { fire("complete"); endAd(); } else { close(); }
    });

    v.addEventListener("error", function () {
      if (mode === "ad") { log("ad video failed to load, error code:", v.error && v.error.code); endAd(); return; }          // ad file blocked/broken -> go straight to your video
      if (!started || closed) return;
      if (retries < 3) {
        retries++; msg.textContent = "Reconnecting\u2026 (" + retries + "/3)";
        setTimeout(function () { if (!closed) { load(true); tryPlay(); } }, 1200 * retries);
      } else {
        msg.textContent = "Video could not load.";
      }
    });

    load(false);
  }

  if (document.body) { init(); } else { document.addEventListener("DOMContentLoaded", init); }
})();