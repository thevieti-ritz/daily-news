/* ============================================================
   intro.js  -  INTRO VIDEO LAYER + VAST AD (one file for ALL pages)
   Add this ONE line right after <body> on every page:
       <script src="/intro.js"></script>
   Edit the SETTINGS below, upload to GitHub, and every page updates.
   ============================================================ */
(function () {

    /* ---------------- SETTINGS ---------------- */
    var INTRO_VIDEO_URL   = "https://pub-947189f89d8c4deba38620dab133e00a.r2.dev/9abc6d2cb7ff4c9e8e15f1662ae84e68.mp4"; // 1) your video link
    var CLOSE_AFTER_SECS  = 35;    // 2) layer closes this many seconds after Play is clicked
    var SHOW_ONCE_PER_SESSION = false; // 3) true = once per visit, false = every page load
    var INTRO_POSTER      = "";    // 4) optional picture shown before play (image link), or leave empty
    var AD_TAG_URL        = "/media/feed.xml"; // 5) your Cloudflare Worker route (same domain). Empty "" = no ad
    var AD_SKIP_AFTER_SECS = 5;    // 6) skip button delay if the VAST doesn't specify one (0 = no skip button)
    var AD_START_TIMEOUT  = 15000;  // 7) ms to wait for the ad to start before falling back to your video
    var LOCK_OTHER_ADS    = true;  // 8) true = block popunders/popups/outside clicks while the layer is open
    var AD_WAIT_MAX       = 20000; // 9) ms the Play button waits for the ad to load (slow networks need this)
    var AD_RETRIES        = 3;     // 10) how many times to ask the ad server again when it returns no ad / an error
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
    body.intro-strict > *:not(#introLayer){pointer-events:none!important}
    body.intro-strict > *:not(#introLayer) *{pointer-events:none!important}
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

  /* ---- LOCK: freeze popunders / popups / outside clicks while the layer is open ---- */
  function log() { try { console.log.apply(console, ["[intro]"].concat([].slice.call(arguments))); } catch (e) {} }
  var realOpen = window.open, locked = false;
  var BLOCK_EVENTS = ["click", "auxclick", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"];
  var origAdd = EventTarget.prototype.addEventListener, origRemove = EventTarget.prototype.removeEventListener;
  var wrapped = [], patched = false;

  function inLayer(e) {
    var l = document.getElementById("introLayer");
    return !!(l && e && e.target && e.target.nodeType && l.contains(e.target));
  }
  function isRoot(t) { return t === window || t === document || t === document.documentElement || t === document.body; }

  // Any OTHER script (popunder scripts) that listens for clicks on the page is wrapped so it
  // never hears a click/tap that happens inside the intro layer while the layer is open.
  function patchListeners() {
    if (patched) return; patched = true;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (fn && isRoot(this) && BLOCK_EVENTS.indexOf(type) > -1) {
        var cap = typeof opts === "boolean" ? opts : !!(opts && opts.capture);
        for (var i = 0; i < wrapped.length; i++) { var w0 = wrapped[i]; if (w0.t === this && w0.type === type && w0.cap === cap && w0.fn === fn) return; }
        var w = function (e) {
          if (locked && inLayer(e)) return;                 // ad scripts are deaf while the intro is open
          return typeof fn === "function" ? fn.apply(this, arguments) : fn.handleEvent(e);
        };
        wrapped.push({ t: this, type: type, cap: cap, fn: fn, w: w });
        return origAdd.call(this, type, w, opts);
      }
      return origAdd.apply(this, arguments);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      var cap = typeof opts === "boolean" ? opts : !!(opts && opts.capture);
      for (var i = 0; i < wrapped.length; i++) {
        var x = wrapped[i];
        if (x.t === this && x.type === type && x.cap === cap && x.fn === fn) { wrapped.splice(i, 1); return origRemove.call(this, type, x.w, opts); }
      }
      return origRemove.apply(this, arguments);
    };
  }

  function guard(e) {
    if (!locked) return;
    var inside = inLayer(e);
    var t = e.target;
    var onControl = inside && t && t.closest && t.closest("button,video,a,input");
    // block: script-made clicks, clicks outside the layer, and taps on the blank black area of the layer
    if (!e.isTrusted || !inside || !onControl) {
      e.stopImmediatePropagation();
      if (e.cancelable) e.preventDefault();
      log("blocked", e.type, !e.isTrusted ? "(script-made click)" : (!inside ? "(outside click)" : "(blank area tap)"));
    }
  }
  function lock() {
    if (locked) return; locked = true;
    patchListeners();
    window.open = function () { log("blocked a popup/popunder"); return null; };
    BLOCK_EVENTS.forEach(function (t) { origAdd.call(window, t, guard, { capture: true, passive: false }); });
  }
  function unlock() {
    if (!locked) return; locked = false;
    window.open = realOpen;
    BLOCK_EVENTS.forEach(function (t) { origRemove.call(window, t, guard, true); });
  }
  var seenAlready = false;
  try { seenAlready = SHOW_ONCE_PER_SESSION && sessionStorage.getItem("introSeen") === "1"; } catch (e) {}
  if (LOCK_OTHER_ADS && !seenAlready) { lock(); }   // runs immediately, before the page's other scripts click anything

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
    if (LOCK_OTHER_ADS) document.body.classList.add("intro-strict");
    if (main) main.setAttribute("inert", "");
    if (INTRO_POSTER) v.poster = INTRO_POSTER;

    function close() {
      if (closed) return; closed = true;
      clearInterval(tick);
      try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
      try { v.pause(); } catch (e) {}
      layer.classList.add("intro-hide");
      document.body.classList.remove("intro-lock");
      document.body.classList.remove("intro-strict");
      unlock();
      if (main) main.removeAttribute("inert");
      cnt.classList.add("intro-hidden");
      setTimeout(function () { layer.remove(); cnt.remove(); }, 450);
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

    function resetAd() { ad.ready = false; ad.media = ""; ad.cands = []; ad.ci = 0; ad.imp = []; ad.trk = {}; ad.prog = []; ad.click = ""; ad.clickTrk = []; ad.skip = -1; ad.fired = {}; }
    function loadVastRetry(attempt) {
      resetAd();
      return loadVast(AD_TAG_URL, 0).catch(function (err) {
        log("ad request " + attempt + "/" + (AD_RETRIES + 1) + " failed:", (err && err.message) ? err.message : err);
        if (attempt > AD_RETRIES) throw err;
        return new Promise(function (res) { setTimeout(res, 700); }).then(function () { return loadVastRetry(attempt + 1); });
      });
    }

    function loadVast(url, depth) {
      return fetch(url, { credentials: "omit", cache: "no-store" }).then(function (r) { return r.text(); }).then(function (t) {
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
        // prefer a fast-starting file (largest up to 720px wide), then the bigger ones as backups
        files.sort(function (a, b) {
          var wa = +a.getAttribute("width") || 0, wb = +b.getAttribute("width") || 0;
          var ra = wa > 720 ? 1 : 0, rb = wb > 720 ? 1 : 0;
          if (ra !== rb) return ra - rb;
          return ra === 0 ? wb - wa : wa - wb;
        });
        ad.cands = files.map(txt).filter(Boolean); ad.ci = 0;
        ad.media = ad.cands[0] || "";
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
      v.src = ad.media; v.load();
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

    skipBtn.addEventListener("click", function () { if (skipBtn.disabled) return; fire("skip"); endAd(); });
    v.addEventListener("click", function () {
      if (mode !== "ad" || !ad.click) return;
      ad.clickTrk.forEach(ping); fire("clickthrough");
      try { v.pause(); } catch (e) {}
      realOpen.call(window, ad.click, "_blank", "noopener");
    });
    v.addEventListener("timeupdate", adTimeUpdate);

    // prefetch the VAST now so playback can begin synchronously inside the user's tap
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
      loadVastRetry(1)
        .then(function () { openGate("ad ready"); })
        .catch(function (err) { ad.ready = false; log("NO AD:", (err && err.message) ? err.message : err); openGate("no ad available"); });
    }
    /* ========================================================== */

    playBtn.addEventListener("click", function () {
      startClock(); playBtn.classList.add("intro-hidden");
      if (AD_TAG_URL && !ad.ready && !ad.adDone) log("Play tapped but the ad was not ready, so your video plays instead");
      if (mode === "content" && ad.ready && !ad.fired.start && !ad.adDone) { ad.adDone = true; playAd(); return; }
      v.controls = true;
      if (v.error) { load(true); }
      tryPlay();
    });

    v.addEventListener("play", function () {
      playBtn.classList.add("intro-hidden"); startClock();
      if (mode === "ad") { clearTimeout(ad.watchdog); fire("impression"); fire("start"); log("ad playing"); }
    });
    v.addEventListener("pause", function () { if (!closed && !v.ended) playBtn.classList.remove("intro-hidden"); });
    v.addEventListener("ended", function () {
      if (mode === "ad") { fire("complete"); endAd(); }   // your video ending never closes the layer; only the countdown does
    });

    v.addEventListener("error", function () {
      if (mode === "ad") {
        log("ad video failed to load, error code:", v.error && v.error.code);
        if (ad.cands && ad.ci + 1 < ad.cands.length) { ad.ci++; ad.media = ad.cands[ad.ci]; log("trying backup ad file", ad.ci + 1); v.src = ad.media; v.load(); tryPlay(); return; }
        endAd(); return;
      }          // ad file blocked/broken -> go straight to your video
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