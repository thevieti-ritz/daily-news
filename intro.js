/* ============================================================
   intro.js  -  INTRO VIDEO LAYER + VAST AD (one file for ALL pages)
   Add this ONE line right after <body> on every page:
       <script src="/intro.js"></script>
   Edit the SETTINGS below, upload to GitHub, and every page updates.
   ============================================================ */
(function () {
  /* ---------------- SETTINGS ---------------- */
  var INTRO_VIDEO_URL =
    "https://pub-00a.r2.dev/No_Copyright_Video%2C_Background%2C_Green_Screen%2C_Motion_Graphics%2C_Animated_Background%2C_Copyright_Free(480p).mp4"; // 1) your video link
  var CLOSE_AFTER_SECS = 15; // 2) layer closes this many seconds after Play is clicked
  var MAX_SHOWS = 3; // 3) intro shows this many times per window, per page (0 = every page load)
  var WINDOW_MINUTES = 1; //    ...the window starts at the FIRST counted show and lasts this many minutes
  var INTRO_POSTER = ""; // 4) optional picture shown before play (image link), or leave empty
  var AD_TAG_URL = "/media/feed.xml"; // 5) your Cloudflare Worker route (same domain). Empty "" = no ad
  var AD_SKIP_AFTER_SECS = 5; // 6) skip button delay if the VAST doesn't specify one (0 = no skip button)
  var AD_START_TIMEOUT = 20000; // 7) ms after the tap to wait for the ad to start before falling back
  var AD_WAIT_MAX = 20000; // 8) MAX ms Play stays locked in total (ad request + buffering)
  var AD_PRELOAD = true; // 9) true = download the ad video while the visitor looks at the page
  var AD_BUFFER_WAIT = 6000; // 10) extra ms to let the ad video buffer before unlocking Play anyway
  var AD_RETRIES = 4; // 11) extra tries when the ad server answers with no ad (0 = no retries)
  var AD_REQUIRED = true; // 12) true = intro only runs with a pre-roll ad. No ad = layer closes instantly
  var AD_FETCH_TIMEOUT = 1500; // 13) ms before a single ad request is abandoned and retried
  var AD_RETRY_DELAY = 500; // 14) ms pause between ad retries
  /* With 1500ms timeout + 500ms delay, retry #1 starts within ~2s and retry #2 within ~4s,
     so at least 2 retries always happen inside the first 5 seconds of the page loading. */
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

  function log() {
    try {
      console.log.apply(console, ["[intro]"].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  /* ---------- show limiter: MAX_SHOWS per page per window ----------
     - A load is only COUNTED once the ad has actually loaded and the intro is
       ready to show. Loads where no ad is available are NOT counted.
     - The first counted show starts the window timer.
     - Every counted show inside the window adds 1 until MAX_SHOWS is reached
       (no minimum gap between shows: refresh instantly or after 50s, both count).
     - After MAX_SHOWS, loads are skipped until the window (from the first counted show) ends.
     - Then the next counted show starts a fresh window. */
  var seenAlready = false,
    seenKey = "introShown:" + location.pathname,
    counted = false;

  // returns the active record for this page, or null if none / expired / invalid
  function readRec() {
    try {
      var now = Date.now(),
        win = WINDOW_MINUTES * 60000;
      var rec = JSON.parse(localStorage.getItem(seenKey) || "null");
      var valid =
        rec &&
        typeof rec === "object" &&
        !Array.isArray(rec) &&
        +rec.start > 0 &&
        +rec.count >= 0 &&
        rec.start <= now &&
        now - rec.start < win;
      return valid ? rec : null;
    } catch (e) {
      return null;
    }
  }

  // called once, only when an ad has really loaded for this page view
  function commitShow() {
    if (MAX_SHOWS <= 0 || counted) return;
    counted = true;
    try {
      var rec = readRec();
      if (!rec) {
        rec = { start: Date.now(), count: 1 }; // first counted show: start the timer
      } else {
        rec.count++;
      }
      localStorage.setItem(seenKey, JSON.stringify(rec));
      log("show counted " + rec.count + "/" + MAX_SHOWS);
    } catch (e) {}
  }

  // check only (does NOT count): is the limit already reached?
  if (MAX_SHOWS > 0) {
    var rec0 = readRec();
    if (rec0 && rec0.count >= MAX_SHOWS) {
      seenAlready = true; // reached the limit: skip until the window ends
      log("show skipped (limit reached)");
    }
  }
  // other scripts on the page can read this flag (true while the intro is showing) and listen for the "introclosed" event
  if (!seenAlready) {
    window.__introActive = true;
  }

  function init() {
    if (seenAlready) {
      return;
    }

    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    var holder = document.createElement("div");
    holder.innerHTML = HTML;
    while (holder.lastChild) {
      document.body.insertBefore(holder.lastChild, document.body.firstChild);
    }

    var layer = document.getElementById("introLayer");
    var v = document.getElementById("introVideo"),
      playBtn = document.getElementById("introPlay"),
      msg = document.getElementById("introMsg"),
      cnt = document.getElementById("introCount"),
      adTag = document.getElementById("introAdTag"),
      skipBtn = document.getElementById("introSkip"),
      main = document.getElementById("mainContent"),
      started = false,
      closed = false,
      retries = 0,
      endAt = 0,
      tick = null;

    /* ---------- ad state ---------- */
    var mode = "content"; // "ad" while the ad is playing
    var ad = {
      ready: false,
      media: "",
      imp: [],
      trk: {},
      prog: [],
      click: "",
      clickTrk: [],
      skip: -1,
      fired: {},
      watchdog: null,
    };

    document.body.classList.add("intro-lock");
    if (main) main.setAttribute("inert", "");
    if (INTRO_POSTER) v.poster = INTRO_POSTER;

    // close(true) = instant (no fade), used when there is no ad
    function close(instant) {
      if (closed) return;
      closed = true;
      clearInterval(tick);
      clearTimeout(gateTimer);
      clearTimeout(ad.watchdog);
      try {
        v.pause();
      } catch (e) {}
      if (instant) layer.style.transition = "none";
      layer.classList.add("intro-hide");
      document.body.classList.remove("intro-lock");
      if (main) main.removeAttribute("inert");
      cnt.classList.add("intro-hidden");
      setTimeout(
        function () {
          layer.remove();
          cnt.remove();
          window.__introActive = false;
          try {
            document.dispatchEvent(new Event("introclosed"));
          } catch (e) {}
        },
        instant ? 0 : 450,
      );
    }

    function startClock() {
      if (started) return;
      started = true;
      cnt.classList.remove("intro-hidden");
      endAt = Date.now() + CLOSE_AFTER_SECS * 1000;
      function update() {
        var left = Math.ceil((endAt - Date.now()) / 1000);
        if (left <= 0) {
          close();
          return;
        }
        cnt.textContent = "Site opens in " + left + "s";
      }
      update();
      tick = setInterval(update, 250);
    }

    function load(bust) {
      v.src = bust
        ? INTRO_VIDEO_URL +
          (INTRO_VIDEO_URL.indexOf("?") > -1 ? "&" : "?") +
          "r=" +
          Date.now()
        : INTRO_VIDEO_URL;
      v.load();
    }

    function tryPlay() {
      msg.textContent = "";
      var p = v.play();
      if (p && p.catch)
        p.catch(function () {
          msg.textContent = "Tap the play button again.";
          playBtn.classList.remove("intro-hidden");
        });
    }

    /* =====================  VAST PRE-ROLL  ===================== */
    function ping(url) {
      try {
        new Image().src = url
          .replace("[TIMESTAMP]", Date.now())
          .replace("[CACHEBUSTING]", Math.random().toString().slice(2));
      } catch (e) {}
    }
    function fire(ev) {
      if (ad.fired[ev]) return;
      ad.fired[ev] = 1;
      (ev === "impression" ? ad.imp : ad.trk[ev] || []).forEach(ping);
    }
    function txt(n) {
      return n ? (n.textContent || "").trim() : "";
    }
    function toSecs(s) {
      var p = (s || "").split(":");
      return p.length === 3 ? +p[0] * 3600 + +p[1] * 60 + parseFloat(p[2]) : -1;
    }

    // fetch with a timeout so a slow/hanging ad server can't eat the retry window
    function fetchT(url) {
      var ctl = window.AbortController ? new AbortController() : null;
      var timer;
      var timeout = new Promise(function (_, rej) {
        timer = setTimeout(function () {
          if (ctl) {
            try {
              ctl.abort();
            } catch (e) {}
          }
          rej(new Error("ad request timed out"));
        }, AD_FETCH_TIMEOUT);
      });
      var req = fetch(url, {
        credentials: "omit",
        cache: "no-store",
        signal: ctl ? ctl.signal : undefined,
      }).then(function (r) {
        if (!r.ok) throw new Error("ad server HTTP " + r.status);
        return r.text();
      });
      return Promise.race([req, timeout]).then(
        function (t) {
          clearTimeout(timer);
          return t;
        },
        function (e) {
          clearTimeout(timer);
          throw e;
        },
      );
    }

    function loadVast(url, depth) {
      return fetchT(url).then(function (t) {
        var doc = new DOMParser().parseFromString(t, "text/xml");
        var node =
          doc.querySelector("Ad > InLine") || doc.querySelector("Ad > Wrapper");
        if (!node) throw new Error("no ad");
        [].forEach.call(node.querySelectorAll("Impression"), function (n) {
          ad.imp.push(txt(n));
        });
        [].forEach.call(node.querySelectorAll("Tracking"), function (n) {
          var e = n.getAttribute("event");
          if (e === "progress") {
            ad.prog.push({
              off: n.getAttribute("offset") || "",
              url: txt(n),
              done: false,
            });
            return;
          }
          (ad.trk[e] = ad.trk[e] || []).push(txt(n));
        });
        [].forEach.call(node.querySelectorAll("ClickTracking"), function (n) {
          ad.clickTrk.push(txt(n));
        });
        var ct = node.querySelector("ClickThrough");
        if (ct && !ad.click) ad.click = txt(ct);
        var lin = node.querySelector("Linear");
        if (lin && lin.getAttribute("skipoffset")) {
          var so = lin.getAttribute("skipoffset");
          ad.skip =
            so.indexOf("%") > -1 ? -2 - parseFloat(so) / 100 : toSecs(so); // -2-x = percentage, resolved later
        }
        if (node.tagName === "Wrapper") {
          var next = txt(node.querySelector("VASTAdTagURI"));
          if (!next || depth >= 3) throw new Error("wrapper end");
          return loadVast(next, depth + 1);
        }
        // pick the best progressive MP4 (largest up to 1280px wide)
        var files = [].filter.call(
          node.querySelectorAll("MediaFile"),
          function (m) {
            var type = (m.getAttribute("type") || "").toLowerCase(),
              d = (m.getAttribute("delivery") || "progressive").toLowerCase();
            return (
              d === "progressive" &&
              (type.indexOf("mp4") > -1 || /\.mp4(\?|$)/i.test(txt(m)))
            );
          },
        );
        if (!files.length) throw new Error("no mp4");
        files.sort(function (a, b) {
          var wa = +a.getAttribute("width") || 0,
            wb = +b.getAttribute("width") || 0;
          var ra = wa > 1280 ? -wa : wa,
            rb = wb > 1280 ? -wb : wb;
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
      adTag.classList.add("intro-hidden");
      skipBtn.classList.add("intro-hidden");
      v.controls = true;
      msg.textContent = "";
      load(false);
      tryPlay();
    }

    function playAd() {
      mode = "ad";
      v.controls = false;
      if (!ad.preloaded) {
        v.src = ad.media;
        v.load();
      } // already downloading? just press play
      adTag.classList.remove("intro-hidden");
      ad.watchdog = setTimeout(function () {
        if (mode === "ad" && !ad.fired.start) {
          log("ad did not start in time, playing your video");
          endAd();
        }
      }, AD_START_TIMEOUT);
      tryPlay();
    }

    function adTimeUpdate() {
      if (mode !== "ad" || !v.duration) return;
      var t = v.currentTime,
        d = v.duration,
        pct = t / d;
      if (pct >= 0.25) fire("firstQuartile");
      if (pct >= 0.5) fire("midpoint");
      if (pct >= 0.75) fire("thirdQuartile");
      ad.prog.forEach(function (p) {
        if (p.done) return;
        var at =
          p.off.indexOf("%") > -1
            ? (parseFloat(p.off) / 100) * d
            : toSecs(p.off);
        if (at >= 0 && t >= at) {
          p.done = true;
          ping(p.url);
        }
      });
      var skipAt =
        ad.skip <= -2
          ? -(ad.skip + 2) * d
          : ad.skip >= 0
            ? ad.skip
            : AD_SKIP_AFTER_SECS;
      if (skipAt >= d - 1) {
        skipBtn.classList.add("intro-hidden");
        return;
      } // skip point is after the ad ends: no button
      if (skipAt > 0 || ad.skip === 0) {
        skipBtn.classList.remove("intro-hidden");
        if (t >= skipAt) {
          skipBtn.disabled = false;
          skipBtn.textContent = "Skip Ad \u25B6";
        } else {
          skipBtn.disabled = true;
          skipBtn.textContent = "Skip in " + Math.ceil(skipAt - t) + "s";
        }
      }
    }

    var onSkip = function () {
      if (skipBtn.disabled) return;
      fire("skip");
      endAd();
    };
    skipBtn.addEventListener("click", onSkip);
    v.addEventListener("timeupdate", adTimeUpdate);

    // prefetch the VAST now so playback can begin synchronously inside the user's tap
    // ask again if the ad server answers with no ad (a fresh request each time)
    function resetAd() {
      ad.imp = [];
      ad.trk = {};
      ad.prog = [];
      ad.click = "";
      ad.clickTrk = [];
      ad.skip = -1;
      ad.media = "";
      ad.ready = false;
    }
    function fetchAd(n) {
      resetAd();
      return loadVast(AD_TAG_URL, 0).catch(function (err) {
        if (n < AD_RETRIES && !started && !closed) {
          log(
            "no ad (" +
              ((err && err.message) || err) +
              "), retry " +
              (n + 1) +
              "/" +
              AD_RETRIES,
          );
          return new Promise(function (r) {
            setTimeout(r, AD_RETRY_DELAY);
          }).then(function () {
            return fetchAd(n + 1);
          });
        }
        throw err;
      });
    }

    // start downloading the ad video right away; Play unlocks once enough is buffered
    function preloadAd() {
      ad.preloaded = true;
      v.controls = false;
      v.preload = "auto";
      v.src = ad.media;
      v.load();
      adTag.classList.remove("intro-hidden");
      var bufTimer = setTimeout(function () {
        openGate("ad video still buffering, unlocked anyway");
      }, AD_BUFFER_WAIT);
      v.addEventListener("canplay", function onCan() {
        v.removeEventListener("canplay", onCan);
        clearTimeout(bufTimer);
        log("ad video buffered");
        openGate("ad video buffered");
      });
      v.addEventListener("error", function onErr() {
        if (mode === "ad" || ad.fired.start) return; // errors during/after the ad are handled elsewhere
        v.removeEventListener("error", onErr);
        clearTimeout(bufTimer);
        ad.ready = false;
        ad.preloaded = false;
        adTag.classList.add("intro-hidden");
        log("ad video preload failed");
        if (AD_REQUIRED) {
          close(true); // no usable ad: close immediately, not counted
          return;
        }
        load(false);
        openGate("ad video failed");
      });
    }

    // Play stays locked until the ad is ready (or AD_WAIT_MAX passes), so the ad is never skipped by tapping too early
    var gateTimer = null,
      gateOpen = true;
    function openGate(why) {
      if (gateOpen) return;
      gateOpen = true;
      clearTimeout(gateTimer);