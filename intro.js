/* ============================================================
   intro.js  -  INTRO LAYER WITH PRE-ROLL AD ONLY (one file for ALL pages)
   Add this ONE line right after <body> on every page:
       <script src="/intro.js"></script>
   The layer plays the ad video only. When the ad ends (or the
   timer runs out, or the ad is skipped, or no ad is available)
   the layer closes and the site opens. No other video is played.
   ============================================================ */
(function () {
  /* ---------------- SETTINGS ---------------- */
  var CLOSE_AFTER_SECS = 10; // 1) layer closes this many seconds after Play is clicked
  var MAX_SHOWS = 2; // 2) intro shows at most this many times per window (0 = every page load)
  var WINDOW_MINUTES = 1; //    ...within this many minutes
  var AD_TAG_URL = "/media/feed.xml"; // 3) your Cloudflare Worker route (same domain)
  var AD_SKIP_AFTER_SECS = 5; // 4) skip button delay if the VAST doesn't specify one (0 = no skip button)
  var AD_START_TIMEOUT = 20000; // 5) ms after the tap to wait for the ad to start before closing the layer
  var AD_WAIT_MAX = 20000; // 6) MAX ms Play stays locked (ad request + buffering). After this the layer closes
  var AD_PRELOAD = true; // 7) true = download the ad video while the visitor looks at the page, so it starts instantly
  var AD_BUFFER_WAIT = 6000; // 8) extra ms to let the ad video buffer before unlocking Play anyway (iPhones ignore preloading)
  var AD_RETRIES = 4; // 9) extra tries when the ad server answers with no ad (0 = no retries)
  var AD_REQUEST_TIMEOUT = 7000; // 10) ms to wait for ONE ad request before giving up on it and trying again
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
      <video id="introVideo" playsinline preload="metadata" controlsList="nodownload noremoteplayback"></video>
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
  var seenAlready = false,
    seenKey = "introShown:" + location.pathname;
  if (MAX_SHOWS > 0) {
    try {
      var now = Date.now(),
        win = WINDOW_MINUTES * 60000;
      var times = JSON.parse(localStorage.getItem(seenKey) || "[]");
      if (!Array.isArray(times)) times = [];
      times = times.filter(function (t) {
        return now - t < win;
      }); // keep only shows inside the window
      if (times.length >= MAX_SHOWS) {
        seenAlready = true; // limit reached: skip the intro
      } else {
        times.push(now); // record this show
        localStorage.setItem(seenKey, JSON.stringify(times));
      }
    } catch (e) {}
  }
  // other scripts on the page can read this flag (true while the intro is showing) and listen for the "introclosed" event
  if (!seenAlready) {
    window.__introActive = true;
  }

  function init() {
    if (seenAlready) {
      return;
    }
    if (!AD_TAG_URL) {
      window.__introActive = false; // no ad route set: nothing to show
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
      endAt = 0,
      tick = null;

    /* ---------- ad state ---------- */
    var mode = "idle"; // "ad" while the ad is playing
    var ad = {
      ready: false,
      media: "",
      files: [],
      idx: 0,
      imp: [],
      trk: {},
      prog: [],
      click: "",
      clickTrk: [],
      skip: -1,
      fired: {},
      watchdog: null,
    };

    v.controls = false;
    document.body.classList.add("intro-lock");
    if (main) main.setAttribute("inert", "");

    function close() {
      if (closed) return;
      closed = true;
      clearInterval(tick);
      clearTimeout(gateTimer);
      clearTimeout(ad.watchdog);
      try {
        v.pause();
      } catch (e) {}
      layer.classList.add("intro-hide");
      document.body.classList.remove("intro-lock");
      if (main) main.removeAttribute("inert");
      cnt.classList.add("intro-hidden");
      setTimeout(function () {
        layer.remove();
        cnt.remove();
        window.__introActive = false;
        try {
          document.dispatchEvent(new Event("introclosed"));
        } catch (e) {}
      }, 450);
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

    // one ad request: never cached, and never allowed to hang forever
    function fetchText(url, depth) {
      var u = url;
      if (depth === 0) {
        // only our own route gets the cache-buster (third-party wrapper links may be signed)
        u +=
          (url.indexOf("?") > -1 ? "&" : "?") +
          "_=" +
          Date.now() +
          Math.random().toString(36).slice(2, 7);
      }
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl
        ? setTimeout(function () {
            ctrl.abort();
          }, AD_REQUEST_TIMEOUT)
        : null;
      return fetch(u, {
        credentials: "omit",
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined,
      }).then(
        function (r) {
          clearTimeout(timer);
          if (!r.ok) throw new Error("ad server answered HTTP " + r.status);
          return r.text();
        },
        function (e) {
          clearTimeout(timer);
          throw e;
        },
      );
    }

    function loadVast(url, depth) {
      return fetchText(url, depth).then(function (t) {
        var doc = new DOMParser().parseFromString(t, "text/xml");
        if (doc.querySelector("parsererror"))
          throw new Error("ad answer was not valid VAST");
        var node =
          doc.querySelector("Ad > InLine") || doc.querySelector("Ad > Wrapper");
        if (!node) throw new Error("no ad (empty VAST)");
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
          ad.skip = so.indexOf("%") > -1 ? -2 - parseFloat(so) / 100 : toSecs(so); // -2-x = percentage, resolved later
        }
        if (node.tagName === "Wrapper") {
          var next = txt(node.querySelector("VASTAdTagURI"));
          if (!next || depth >= 4) throw new Error("wrapper chain ended with no ad");
          return loadVast(next, depth + 1);
        }

        // collect every playable video file, best first
        var all = [].slice.call(node.querySelectorAll("MediaFile"));
        function typeOf(m) {
          return (m.getAttribute("type") || "").toLowerCase();
        }
        function isStream(m) {
          return (
            (m.getAttribute("delivery") || "").toLowerCase() === "streaming" ||
            /\.m3u8(\?|$)/i.test(txt(m)) ||
            typeOf(m).indexOf("mpegurl") > -1
          );
        }
        var mp4s = all.filter(function (m) {
          return (
            !isStream(m) &&
            (typeOf(m).indexOf("mp4") > -1 || /\.mp4(\?|$)/i.test(txt(m)))
          );
        });
        var others = all.filter(function (m) {
          if (isStream(m) || mp4s.indexOf(m) > -1) return false;
          var ty = typeOf(m);
          try {
            return ty && v.canPlayType(ty) !== "";
          } catch (e) {
            return false;
          }
        });
        function rank(list) {
          return list.sort(function (a, b) {
            var wa = +a.getAttribute("width") || 0,
              wb = +b.getAttribute("width") || 0;
            var ra = wa > 1280 ? -wa : wa,
              rb = wb > 1280 ? -wb : wb;
            return rb - ra;
          });
        }
        var picked = rank(mp4s).concat(rank(others));
        if (!picked.length) throw new Error("no playable video file in the ad");
        ad.files = picked.map(txt).filter(Boolean);
        ad.idx = 0;
        ad.media = ad.files[0] || "";
        ad.ready = !!ad.media;
        log("ad ready:", ad.media, "(" + ad.files.length + " file option(s))");
      });
    }

    function playAd() {
      mode = "ad";
      if (!ad.preloaded) {
        v.src = ad.media;
        v.load();
      } // already downloading? just press play
      adTag.classList.remove("intro-hidden");
      ad.watchdog = setTimeout(function () {
        if (mode === "ad" && !ad.fired.start) {
          log("ad did not start in time, closing the layer");
          close();
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
      close();
    };
    skipBtn.addEventListener("click", onSkip);
    v.addEventListener("timeupdate", adTimeUpdate);

    // ask again if the ad server answers with no ad (a fresh, uncached request each time)
    function resetAd() {
      ad.imp = [];
      ad.trk = {};
      ad.prog = [];
      ad.click = "";
      ad.clickTrk = [];
      ad.skip = -1;
      ad.media = "";
      ad.files = [];
      ad.idx = 0;
      ad.ready = false;
    }
    function fetchAd(n) {
      resetAd();
      return loadVast(AD_TAG_URL, 0).catch(function (err) {
        if (n < AD_RETRIES && !started && !closed) {
          log(
            "no ad (" +
              ((err && err.message) || err) +
              "), asking again " +
              (n + 1) +
              "/" +
              AD_RETRIES,
          );
          return new Promise(function (r) {
            setTimeout(r, 500 + n * 400);
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
      v.preload = "auto";
      v.src = ad.media;
      v.load();
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
        if (mode === "ad" || ad.fired.start) return; // errors during the ad are handled below
        // this video file is broken: try the next video file the ad offered
        if (ad.idx + 1 < ad.files.length) {
          ad.idx++;
          ad.media = ad.files[ad.idx];
          log("ad video file failed, trying next file:", ad.media);
          v.src = ad.media;
          v.load();
          return;
        }
        v.removeEventListener("error", onErr);
        clearTimeout(bufTimer);
        log("ad video could not load, closing the layer");
        close();
      });
    }

    // Play stays locked until the ad is ready, so the ad is never skipped by tapping too early
    var gateTimer = null,
      gateOpen = false;
    function openGate(why) {
      if (gateOpen || closed) return;
      gateOpen = true;
      clearTimeout(gateTimer);
      playBtn.disabled = false;
      playBtn.style.opacity = "";
      if (msg.textContent === "Loading\u2026") msg.textContent = "";
      log("Play unlocked:", why);
    }
    playBtn.disabled = true;
    playBtn.style.opacity = ".55";
    msg.textContent = "Loading\u2026";
    gateTimer = setTimeout(function () {
      if (!ad.ready) {
        log("waited " + AD_WAIT_MAX / 1000 + "s, no ad, closing the layer");
        close();
      } else {
        openGate("waited " + AD_WAIT_MAX / 1000 + "s");
      }
    }, AD_WAIT_MAX);
    fetchAd(0)
      .then(function () {
        if (closed) return;
        if (AD_PRELOAD && ad.ready) {
          preloadAd();
        } else {
          openGate("ad ready");
        }
      })
      .catch(function (err) {
        ad.ready = false;
        log("NO AD after all tries, closing the layer:", err && err.message ? err.message : err);
        close(); // no ad = no intro
      });
    /* ========================================================== */

    playBtn.addEventListener("click", function () {
      startClock();
      playBtn.classList.add("intro-hidden");
      if (!ad.ready) {
        close();
        return;
      }
      if (mode === "ad") {
        tryPlay(); // resume after a pause
        return;
      }
      playAd();
    });

    v.addEventListener("play", function () {
      playBtn.classList.add("intro-hidden");
      startClock();
      if (mode === "ad") {
        clearTimeout(ad.watchdog);
        fire("impression");
        fire("start");
        log("ad playing");
      }
    });
    v.addEventListener("pause", function () {
      if (!closed && !v.ended) playBtn.classList.remove("intro-hidden");
    });
    v.addEventListener("ended", function () {
      if (mode === "ad") fire("complete");
      close(); // ad finished: open the site
    });
    v.addEventListener("error", function () {
      if (mode === "ad") {
        log("ad video failed while playing, error code:", v.error && v.error.code);
        close();
      }
    });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();