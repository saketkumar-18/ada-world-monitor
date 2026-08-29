/* ADA World Monitor — test suite (Node).
 * Runs API layer unit tests against LIVE endpoints.
 * Exit code 0 = all pass.
 */
"use strict";
const path = require("path");
const fs = require("fs");

/* load api.js in a browser-ish shim (api.js uses fetch; Node 18+ has it) */
const src = fs.readFileSync(path.join(__dirname, "..", "js", "api.js"), "utf8");
const windowShim = {};
const wrapped = src
  .replace(/^"use strict";/, "")
  .replace(/module\.exports = API;/, "")
  .replace(/if \(typeof module[\s\S]*?\}\n/, "");
const vm = require("vm");
const ctx = { fetch, AbortController, setTimeout, clearTimeout, DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } }, URL, window: windowShim };
vm.createContext(ctx);
vm.runInContext(wrapped + "\n; this.__API = API;", ctx);
const API = ctx.__API;

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
};

(async () => {
  console.log("== syntax ==");
  for (const f of ["js/app.js", "js/ai.js", "js/brain.js"]) {
    const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    try { new Function(code); t(f + " parses", true); }
    catch (e) { t(f + " parses", false, e.message); }
  }

  console.log("== USGS quakes ==");
  try {
    const q = await API.quakes();
    t("returns array", Array.isArray(q));
    t("has events (M2.5+ 24h)", q.length > 0, "got " + q.length);
    const f = q[0];
    t("shape {mag,place,lat,lon,time,depth,url}", f.mag != null && f.place && typeof f.lat === "number" && typeof f.lon === "number" && f.time && typeof f.depth === "number" && f.url);
    t("sorted newest first", q.length < 2 || q[0].time >= q[1].time);
  } catch (e) { t("USGS live fetch", false, e.message); }

  console.log("== ISS ==");
  try {
    const p = await API.iss();
    t("lat in [-90,90]", Math.abs(p.lat) <= 90);
    t("alt ~400km", p.alt > 300 && p.alt < 500, "alt=" + p.alt);
    t("vel ~27k km/h", p.vel > 20000 && p.vel < 35000, "vel=" + p.vel);
  } catch (e) { t("ISS live fetch", false, e.message); }

  console.log("== Kp space weather ==");
  try {
    const k = await API.kp();
    t("30 readings", k.length === 30, "got " + k.length);
    t("values in [0,9]", k.every(r => r.kp >= 0 && r.kp <= 9));
    t("has timestamps", k.every(r => r.t && r.t.includes("T")));
  } catch (e) { t("SWPC live fetch", false, e.message); }

  console.log("== crypto ==");
  try {
    const c = await API.crypto();
    t("3 coins", c.length === 3, "got " + c.length);
    const btc = c.find(x => x.id === "bitcoin");
    t("btc.usd > 1000", btc && btc.usd > 1000);
    t("btc.chg is number or null", btc && (btc.chg === null || typeof btc.chg === "number"));
  } catch (e) { t("CoinGecko live fetch", false, e.message); }

  console.log("== weather + geo ==");
  try {
    const g = await API.geo("Delhi");
    t("geo finds Delhi", g && g.name.toLowerCase().includes("delhi") || g && g.country === "India");
    const w = await API.weather(g.lat, g.lon);
    t("temp in [-20,60]", w.temp > -20 && w.temp < 60, "temp=" + w.temp);
    const aq = await API.airquality(g.lat, g.lon);
    t("aqi >= 0", aq.aqi >= 0);
  } catch (e) { t("Open-Meteo live fetch", false, e.message); }

  console.log("== news (rss2json) ==");
  try {
    const n = await API.worldNews(5);
    t("world items", n.length > 0);
    t("items have title+link", n.every(x => x.title && x.link));
  } catch (e) { t("BBC feed live fetch", false, e.message); }
  try {
    const n = await API.techNews(5);
    t("tech items", n.length > 0);
  } catch (e) { t("BBC tech feed", false, e.message); }

  console.log("== launches ==");
  try {
    const l = await API.launches();
    t("upcoming list", l.length > 0);
    t("shape {name,net,status}", l[0].name && l[0].net && l[0].status);
  } catch (e) { t("LaunchLibrary live fetch", false, e.message); }

  console.log("== Hacker News ==");
  try {
    const h = await API.hn(5);
    t("top items", h.length === 5);
    t("have score+title", h.every(x => x.title && x.score > 0));
  } catch (e) { t("HN live fetch", false, e.message); }

  console.log("== Frankfurter FX ==");
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,EUR").then((x) => x.json());
    t("fx USD→INR exists", r.rates && r.rates.INR > 50 && r.rates.INR < 120, JSON.stringify(r.rates));
    t("fx date present", typeof r.date === "string");
  } catch (e) { t("Frankfurter live fetch", false, e.message); }

  console.log("== Wikipedia knowledge (multi-lang) ==");
  try {
    const surl = "https://hi.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent("जापान") + "&srlimit=1&format=json&origin=*";
    const sr = await fetch(surl).then((x) => x.json());
    t("hindi wiki search works", sr.query && sr.query.search && sr.query.search.length > 0);
    const title = sr.query.search[0].title;
    const m = await fetch("https://hi.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title)).then((x) => x.json());
    t("hindi wiki summary extract", typeof m.extract === "string" && m.extract.length > 30, "len=" + (m.extract || "").length);
    const en = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/Japan").then((x) => x.json());
    t("english wiki summary extract", typeof en.extract === "string" && en.extract.length > 30);
  } catch (e) { t("Wikipedia live fetch", false, e.message); }

  console.log("== index.html sanity ==");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  t("loads local vendor leaflet (no CDN)", html.includes("vendor/leaflet.js") && !html.includes("unpkg.com/leaflet"));
  t("loads api.js + app.js", html.includes("js/api.js") && html.includes("js/app.js"));
  t("all panel ids referenced in JS exist in HTML", ["space-panel","market-panel","climate-panel","intel-panel","comms-panel","term"].every(id => html.includes('id="' + id)));
  t("vendor leaflet.js present locally", fs.existsSync(path.join(__dirname, "..", "vendor", "leaflet.js")));
  t("vendor leaflet.css present locally", fs.existsSync(path.join(__dirname, "..", "vendor", "leaflet.css")));

  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("SUITE CRASH:", e); process.exit(1); });
