// measure.js — opens your site, scrolls like a visitor, and counts the data used.
// Run:  node measure.js            (home page, 90 seconds)
//       node measure.js https://dailynewsug.online/videos.html 90
const { chromium } = require("playwright");

const URL_TO_TEST = process.argv[2] || "https://dailynewsug.online/";
const SECONDS = parseInt(process.argv[3], 10) || 90;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 800 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");

  const reqs = new Map();
  cdp.on("Network.requestWillBeSent", (e) => {
    reqs.set(e.requestId, { url: e.request.url, type: e.type, bytes: 0 });
  });
  cdp.on("Network.dataReceived", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.bytes += e.encodedDataLength || 0;
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r && e.encodedDataLength > r.bytes) r.bytes = e.encodedDataLength;
  });

  await page.goto(URL_TO_TEST, { waitUntil: "domcontentloaded" }).catch(() => {});
  const end = Date.now() + SECONDS * 1000;
  while (Date.now() < end) {
    await page.mouse.wheel(0, 700).catch(() => {});
    await page.waitForTimeout(2500);
  }

  const mb = (n) => (n / 1048576).toFixed(2) + " MB";
  const byHost = {}, byType = {};
  let total = 0;
  for (const r of reqs.values()) {
    let host = "other";
    try { host = new URL(r.url).host; } catch (_) {}
    byHost[host] = (byHost[host] || 0) + r.bytes;
    byType[r.type] = (byType[r.type] || 0) + r.bytes;
    total += r.bytes;
  }
  const show = (title, obj) => {
    console.log("\n== " + title + " ==");
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .forEach(([k, v]) => console.log(mb(v).padStart(10), " ", k));
  };
  console.log("\nPage:", URL_TO_TEST, "| Time:", SECONDS, "s");
  console.log("TOTAL:", mb(total));
  show("BY WEBSITE", byHost);
  show("BY TYPE", byType);
  console.log("\n== 10 BIGGEST SINGLE DOWNLOADS ==");
  [...reqs.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 10)
    .forEach((r) => console.log(mb(r.bytes).padStart(10), " ", r.type.padEnd(8), r.url.slice(0, 110)));

  await browser.close();
})();