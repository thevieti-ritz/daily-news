/*
  Popunder loader - zone 12354553

  1) Loads the ad tag through your own domain (/js/ob.js, served by the Worker).
  2) If that fails to load, loads it straight from the ad network.
  3) Does nothing inside the Telegram Mini App.
  4) On pages with the intro layer, waits 15 seconds after page load.
*/
(function () {
    var ZONE = "12354553";
    var PROXY_SRC = "/js/ob.js";
    var DIRECT_SRC = "https://al5sm.com/tag.min.js";
    var DELAY_WHEN_INTRO_SECONDS = 15;

    // Never load twice on the same page.
    if (window.__popTagLoaded) return;
    window.__popTagLoaded = true;

    function insideTelegram() {
        var app = window.Telegram && window.Telegram.WebApp;
        return !!((app && app.initData) ||
            window.TelegramWebviewProxy ||
            location.hash.indexOf("tgWebAppData") !== -1);
    }

    function loadTag(src, onFail) {
        var s = document.createElement("script");
        s.dataset.zone = ZONE;
        if (onFail) {
            s.onerror = function () {
                s.remove();
                onFail();
            };
        }
        s.src = src;
        [document.documentElement, document.body].filter(Boolean).pop().appendChild(s);
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