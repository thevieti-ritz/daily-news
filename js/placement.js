/*
  Ad tag loader - placement "index"

  1) Loads the ad tag through your own domain (/js/pl.js, served by the Worker).
  2) If that fails to load, loads it straight from the ad network.
  3) Does nothing inside the Telegram Mini App.
  4) On pages with the intro layer, waits 15 seconds after page load.
*/
(function () {
    var QUERY = "?placementName=index";
    var PROXY_SRC = "/js/pl.js" + QUERY;
    var DIRECT_SRC = "https://bonepa.com/b18e56e576e9350f5b76/7da65f53fa/" + QUERY;
    var DELAY_WHEN_INTRO_SECONDS = 15;

    // Never load twice on the same page.
    if (window.__placementTagLoaded) return;
    window.__placementTagLoaded = true;

    function insideTelegram() {
        var app = window.Telegram && window.Telegram.WebApp;
        return !!((app && app.initData) ||
            window.TelegramWebviewProxy ||
            location.hash.indexOf("tgWebAppData") !== -1);
    }

    function loadTag(src, onFail) {
        var s = document.createElement("script");
        s.type = "text/javascript";
        if (onFail) {
            s.onerror = function () {
                s.remove();
                onFail();
            };
        }
        s.src = src;
        (document.body || document.documentElement).appendChild(s);
    }

    function start() {
        if (insideTelegram()) return;
        loadTag(PROXY_SRC, function () {
            loadTag(DIRECT_SRC);
        });
    }

    if (window.__introActive) {
        var later = function () {
            setTimeout(start, DELAY_WHEN_INTRO_SECONDS * 1000);
        };
        if (document.readyState === "complete") later();
        else window.addEventListener("load", later);
    } else {
        start();
    }
})();