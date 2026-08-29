/* ADA World Monitor — main application.
 * Real data: USGS quakes, ISS position, Kp space weather, crypto,
 * BBC news, Wikipedia events, HN tech, launches, weather/AQI.
 * Voice: Web Speech API. Zero keys. Zero build.
 */
"use strict";

/* ================= state ================= */
const S = {
  quakes: [],
  issTrail: [],        // [{lat,lon,ts}]
  issNow: null,
  kp: [],
  crypto: [],
  news: { world: [], tech: [], wiki: [] },
  launches: [],
  hn: [],
  climate: null,
  live: 0,
  layerOn: { quakes: true, iss: true, choke: true },
};

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const T0 = Date.now();
const fmtTime = (d = new Date()) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
const fmtDate = (d = new Date()) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
};

/* ================= terminal ================= */
const termOut = $("#term-out");
function log(level, tag, text) {
  const ln = document.createElement("div");
  ln.className = "ln " + level;
  const t = document.createElement("span"); t.className = "ts"; t.textContent = "[" + fmtTime() + "] ";
  const g = document.createElement("span"); g.className = "tag"; g.textContent = tag + " ";
  const x = document.createElement("span"); x.className = "txt"; x.textContent = text;
  ln.append(t, g, x);
  termOut.appendChild(ln);
  while (termOut.children.length > 250) termOut.removeChild(termOut.firstChild);
  termOut.scrollTop = termOut.scrollHeight;
}

/* ================= clock ================= */
setInterval(() => {
  $("#clock").textContent = fmtTime();
  $("#dateline").textContent = fmtDate() + " · IST";
  const s = Math.floor((Date.now() - T0) / 1000);
  $("#uptime").textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
}, 500);

/* ================= map ================= */
let map, layerQuakes, layerISS, layerChoke, issMarker, issPath;
const CHOKEPOINTS = [
  { name: "Strait of Hormuz", lat: 26.57, lon: 56.25, note: "~20% of global oil" },
  { name: "Suez Canal", lat: 30.42, lon: 32.35, note: "12% of trade" },
  { name: "Panama Canal", lat: 9.08, lon: -79.68, note: "5% of trade" },
  { name: "Strait of Malacca", lat: 2.5, lon: 101.5, note: "25% of trade" },
  { name: "Bab el-Mandeb", lat: 12.58, lon: 43.33, note: "Red Sea gateway" },
  { name: "Taiwan Strait", lat: 24.5, lon: 119.5, note: "chip supply line" },
  { name: "Bosphorus", lat: 41.1, lon: 29.05, note: "grain corridor" },
  { name: "Danish Straits", lat: 55.7, lon: 11.0, note: "Baltic oil exit" },
];

function initMap() {
  map = L.map("map", { worldCopyJump: true, zoomControl: false, attributionControl: true }).setView([25, 40], 2);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd", maxZoom: 19,
  }).addTo(map);

  layerChoke = L.layerGroup();
  CHOKEPOINTS.forEach((c) => {
    const m = L.marker([c.lat, c.lon], {
      icon: L.divIcon({ className: "choke-icon", iconSize: [8, 8], html: "" }),
    }).bindPopup(`<b style="color:#ff4d5e">${c.name}</b><br><span style="color:#54687c">${c.note}</span>`);
    layerChoke.addLayer(m);
  });

  layerQuakes = L.layerGroup();
  layerISS = L.layerGroup();
  issPath = L.polyline([], { className: "iss-path", color: "#35e0ff", weight: 1.5, dashArray: "4 3", opacity: 0.5 });
  layerOn.choke && layerChoke.addTo(map);
  layerOn.quakes && layerQuakes.addTo(map);
  layerOn.iss && layerISS.addTo(map);
}

function renderQuakes() {
  layerQuakes.clearLayers();
  S.quakes.slice(0, 120).forEach((q) => {
    const r = Math.max(4, Math.min(18, (q.mag || 0) * 3.2));
    const big = q.mag >= 5;
    const m = L.circleMarker([q.lat, q.lon], {
      radius: r / 2, className: "quake-dot" + (big ? " big" : ""), fillColor: big ? "#ff4d5e" : "#ffb454",
      fillOpacity: 0.75, color: "#000", weight: 1,
    }).bindPopup(
      `<b style="color:${big ? "#ff4d5e" : "#ffb454"}">M ${q.mag}</b> ${q.place}<br>` +
      `<span style="color:#54687c">depth ${Math.round(q.depth)} km · ${ago(q.time)} · </span><a href="${q.url}" target="_blank" style="color:#35e0ff">USGS ↗</a>`
    );
    layerQuakes.addLayer(m);
  });
  $("#quake-count").textContent = S.quakes.length;
}

function renderISS() {
  layerISS.clearLayers();
  if (S.issNow) {
    const icon = L.divIcon({ className: "iss-icon", iconSize: [10, 10], html: "" });
    issMarker = L.marker([S.issNow.lat, S.issNow.lon], { icon }).addTo(layerISS)
      .bindPopup(`<b style="color:#35e0ff">ISS</b> · alt ${Math.round(S.issNow.alt)} km · ${Math.round(S.issNow.vel)} km/h<br><span style="color:#54687c">${S.issNow.vis === "daylight" ? "☀ daylight pass" : "🌙 night pass"}</span>`);
    if (S.issTrail.length > 1) issPath.setLatLngs(S.issTrail.map((p) => [p.lat, p.lon])).addTo(layerISS);
    $("#iss-hud").innerHTML = `ISS: <b>${S.issNow.lat.toFixed(1)}°, ${S.issNow.lon.toFixed(1)}°</b> · ${Math.round(S.issNow.alt)} km`;
  }
}

/* ================= left panels ================= */
function kpColor(k) {
  if (k >= 7) return "#ff4d5e";
  if (k >= 5) return "#ffb454";
  if (k >= 4) return "#35e0ff";
  return "#3ddc84";
}
function kpLabel(k) {
  if (k >= 7) return "SEVERE STORM";
  if (k >= 5) return "GEOMAG STORM";
  if (k >= 4) return "UNSETTLED";
  return "QUIET";
}
function renderKp() {
  const box = $("#kp-chart");
  box.innerHTML = "";
  const max = 9;
  S.kp.forEach((r) => {
    const b = document.createElement("div");
    b.className = "bar";
    b.style.height = Math.max(3, (r.kp / max) * 64) + "px";
    b.style.background = kpColor(r.kp);
    b.title = r.t + " · Kp " + r.kp;
    box.appendChild(b);
  });
  const last = S.kp[S.kp.length - 1];
  if (last) {
    const lvl = kpLabel(last.kp);
    $("#kp-meta").innerHTML =
      `Kp <b>${last.kp.toFixed(1)}</b> <span class="kp-badge" style="color:${kpColor(last.kp)};border:1px solid ${kpColor(last.kp)}33">${lvl}</span><br>` +
      `<span style="color:var(--dim)">3-hour readings · last 90h · NOAA SWPC</span>`;
  }
}

function renderCrypto() {
  const box = $("#market-rows");
  box.innerHTML = "";
  S.crypto.forEach((c) => {
    const up = c.chg != null && c.chg >= 0;
    const nm = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL" }[c.id] || c.id.toUpperCase();
    const price = c.usd >= 1000 ? "$" + Math.round(c.usd).toLocaleString("en-IN") : "$" + c.usd.toFixed(2);
    const r = document.createElement("div");
    r.className = "m-row";
    r.innerHTML = `<span class="sym">${nm}</span><span class="nm">${c.id}</span>
      <span class="price">${price}</span>
      <span class="chg ${up ? "up" : "down"}">${c.chg == null ? "--" : (up ? "+" : "") + c.chg.toFixed(1) + "%"}</span>`;
    box.appendChild(r);
  });
}

const WMO = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Storm+hail", 99: "Severe storm" };
function renderClimate() {
  if (!S.climate) return;
  const c = S.climate;
  const cells = [
    ["TEMP", c.temp != null ? c.temp.toFixed(1) + "°C" : "--"],
    ["WIND", c.wind != null ? Math.round(c.wind) + " km/h" : "--"],
    ["HUMIDITY", c.rh != null ? c.rh + "%" : "--"],
    ["AQI (US)", c.aqi != null ? c.aqi : "--"],
    ["SKY", WMO[c.code] || "—"],
    ["PM2.5", c.pm25 != null ? c.pm25.toFixed(1) : "--"],
  ];
  $("#climate-grid").innerHTML = cells.map(([l, v]) =>
    `<div class="c-cell"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join("");
}

/* ================= intel feed ================= */
let intelTab = "world";
function renderIntel() {
  const box = $("#intel-list");
  box.innerHTML = "";
  let items = [];
  if (intelTab === "world") items = S.news.world;
  else if (intelTab === "tech") items = S.news.tech;
  else items = S.news.wiki;

  if (!items.length) {
    box.innerHTML = `<div class="f-item" style="color:var(--muted)">awaiting feed…</div>`;
    return;
  }
  items.forEach((it) => {
    const el = document.createElement("div");
    el.className = "f-item sev-" + (it.sev || "low");
    el.innerHTML = `<div class="f-top"><span class="sev ${it.sev || "low"}">${it.sevTag || "INTEL"}</span><span class="tm">${ago(it.ts)}</span></div>
      <a href="${it.link}" target="_blank" rel="noopener">${it.title}</a>
      <div class="src">${it.src}</div>`;
    box.appendChild(el);
  });
}

$("#intel-tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  document.querySelectorAll("#intel-tabs .tab").forEach((t) => t.classList.remove("active"));
  b.classList.add("active");
  intelTab = b.dataset.tab;
  renderIntel();
});

/* ================= map toggles ================= */
function bindToggles() {
  const apply = () => {
    S.layerOn.quakes ? layerQuakes.addTo(map) : map.removeLayer(layerQuakes);
    S.layerOn.iss ? layerISS.addTo(map) : map.removeLayer(layerISS);
    S.layerOn.choke ? layerChoke.addTo(map) : map.removeLayer(layerChoke);
  };
  [["#toggle-quakes", "quakes"], ["#toggle-iss", "iss"], ["#toggle-choke", "choke"]].forEach(([sel, key]) => {
    const el = $(sel);
    el.classList.add("on");
    el.addEventListener("click", () => { S.layerOn[key] = !S.layerOn[key]; el.classList.toggle("on"); apply(); });
  });
}

/* ================= data refresh ================= */
let liveFeeds = 0;
function bumpLive(ok) { liveFeeds = Math.max(0, liveFeeds + (ok ? 1 : 0)); $("#live-count").textContent = liveFeeds + " FEEDS LIVE"; }

async function refreshQuakes() {
  try {
    S.quakes = await API.quakes();
    renderQuakes();
    const big = S.quakes.filter((q) => q.mag >= 5);
    if (big.length) {
      big.slice(0, 2).forEach((q) => log("warn", "[USGS]", `M${q.mag} — ${q.place} (${ago(q.time)})`));
    }
    bumpLive(true);
  } catch (e) { log("err", "[USGS]", "feed down: " + e.message); }
}

async function refreshISS() {
  try {
    const p = await API.iss();
    S.issNow = p;
    S.issTrail.push({ lat: p.lat, lon: p.lon, ts: Date.now() });
    if (S.issTrail.length > 240) S.issTrail.shift();
    renderISS();
    bumpLive(true);
  } catch (e) { $("#iss-hud").textContent = "ISS: LINK LOST"; }
}

async function refreshKp() {
  try {
    S.kp = await API.kp();
    renderKp();
    bumpLive(true);
  } catch (e) { log("err", "[SWPC]", "space weather feed down"); }
}

async function refreshCrypto() {
  try {
    S.crypto = await API.crypto();
    renderCrypto();
    bumpLive(true);
  } catch (e) { log("err", "[MKT]", "market feed down"); }
}

async function refreshClimate() {
  try {
    const w = await API.weather(28.61, 77.23);
    let aq = null;
    try { aq = await API.airquality(28.61, 77.23); } catch (_) { }
    S.climate = { temp: w.temp, wind: w.wind, rh: w.rh, code: w.code, aqi: aq ? aq.aqi : null, pm25: aq ? aq.pm25 : null };
    renderClimate();
    bumpLive(true);
  } catch (e) { log("err", "[WX]", "climate feed down"); }
}

async function refreshNews() {
  try {
    const world = await API.worldNews(12);
    S.news.world = world.map((n) => ({ ...n, sev: n.title.match(/war|attack|kill|strike|missile|dead|nuclear/i) ? "high" : n.title.match(/flood|quake|protest|sanction|election|court/i) ? "moderate" : "low", sevTag: "WORLD" }));
    renderIntel();
    bumpLive(true);
  } catch (e) { log("err", "[BBC]", "world news feed down"); }
  try {
    const tech = await API.techNews(10);
    S.news.tech = tech.map((n) => ({ ...n, sev: "low", sevTag: "TECH" }));
    if (intelTab === "tech") renderIntel();
    bumpLive(true);
  } catch (e) { /* silent */ }
  try {
    const wiki = await API.wikiEvents(2);
    S.news.wiki = wiki.map((n) => ({ ...n, sev: "moderate", sevTag: "EVENT" }));
    if (intelTab === "wiki") renderIntel();
    bumpLive(true);
  } catch (e) { /* silent */ }
}

async function refreshLaunches() {
  try {
    S.launches = await API.launches();
    if (S.launches.length) {
      const next = S.launches[0];
      log("info", "[LAUNCH]", `${next.name} — ${next.status} · pad: ${next.pad || "TBD"}`);
    }
    bumpLive(true);
  } catch (e) { /* silent */ }
}

async function refreshHN() {
  try {
    S.hn = await API.hn(8);
    bumpLive(true);
  } catch (e) { /* silent */ }
}

async function refreshAll() {
  liveFeeds = 0;
  await Promise.allSettled([refreshQuakes(), refreshISS(), refreshKp(), refreshCrypto(), refreshClimate(), refreshNews(), refreshLaunches(), refreshHN()]);
  log("sys", "[SYS]", `refresh complete · ${liveFeeds} feeds live · next in 120s`);
}

/* ================= voice ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false, ttsOn = true, speaking = false;

const waveCv = $("#wave"), wctx = waveCv.getContext("2d");
function sizeWave() {
  const r = waveCv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  waveCv.width = r.width * dpr; waveCv.height = r.height * dpr;
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawWave(now) {
  const W = waveCv.clientWidth, H = waveCv.clientHeight;
  if (!W) return;
  wctx.clearRect(0, 0, W, H);
  const active = listening || speaking;
  const N = 42, bw = W / N;
  for (let i = 0; i < N; i++) {
    const env = Math.sin((i / N) * Math.PI);
    const amp = active ? (0.25 + 0.75 * Math.abs(Math.sin(now / 130 + i * 0.55)) * Math.random() * 0.9 + 0.1) : 0.06 + 0.04 * Math.sin(now / 600 + i);
    const h = Math.max(2, env * amp * H * 0.9);
    wctx.fillStyle = active ? (listening ? "rgba(255,77,94,.9)" : "rgba(53,224,255,.9)") : "rgba(84,104,124,.5)";
    wctx.fillRect(i * bw + 1, (H - h) / 2, bw - 2, h);
  }
}

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  return vs.find((v) => /en[-_](IN|GB)/i.test(v.lang) && /female|zira|heera|neerja|sonia|libby/i.test(v.name))
    || vs.find((v) => /^en/i.test(v.lang))
    || vs[0];
}
function speak(text) {
  if (!ttsOn || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.04; u.pitch = 1;
  const v = pickVoice();
  if (v) u.voice = v;
  u.onstart = () => { speaking = true; $("#comms-mode").textContent = "RESPONDING"; };
  u.onend = () => { speaking = false; $("#comms-mode").textContent = listening ? "LISTENING" : "STANDBY"; };
  u.onerror = () => { speaking = false; $("#comms-mode").textContent = listening ? "LISTENING" : "STANDBY"; };
  speechSynthesis.speak(u);
}
function respond(text, sayIt = true) {
  log("ok", "[ADA]", text);
  if (sayIt) speak(text);
}

/* ---- briefing: the killer feature ---- */
async function morningBriefing(voice = true) {
  log("info", "[ADA]", "compiling global briefing…");
  const parts = [];

  // quakes
  if (S.quakes.length) {
    const m5 = S.quakes.filter((q) => q.mag >= 5);
    parts.push(`Seismic: ${S.quakes.length} earthquakes above magnitude 2.5 in the last 24 hours${m5.length ? `, including ${m5.length} above magnitude 5 — the strongest, magnitude ${m5[0].mag}, ${m5[0].place}` : ""}.`);
  }
  // space weather
  if (S.kp.length) {
    const last = S.kp[S.kp.length - 1];
    parts.push(`Space weather: geomagnetic Kp index at ${last.kp.toFixed(1)} — ${kpLabel(last.kp).toLowerCase()}.`);
  }
  // markets
  if (S.crypto.length) {
    const btc = S.crypto.find((c) => c.id === "bitcoin");
    if (btc) parts.push(`Markets: Bitcoin at $${Math.round(btc.usd).toLocaleString("en-IN")}, ${btc.chg != null ? (btc.chg >= 0 ? "up" : "down") + Math.abs(btc.chg).toFixed(1) + " percent in 24 hours" : "flat"}.`);
  }
  // ISS
  if (S.issNow) parts.push(`The ISS is over ${S.issNow.lat.toFixed(0)} degrees north, ${Math.abs(S.issNow.lon).toFixed(0)} degrees ${S.issNow.lon >= 0 ? "east" : "west"}.`);
  // climate
  if (S.climate && S.climate.temp != null) {
    parts.push(`Delhi: ${S.climate.temp.toFixed(0)} degrees${S.climate.aqi != null ? `, air quality index ${S.climate.aqi}` : ""}.`);
  }
  // top headline
  if (S.news.world.length) parts.push(`Top story: ${S.news.world[0].title}`);
  // next launch
  if (S.launches.length) {
    const l = S.launches[0];
    parts.push(`Next launch: ${l.name}.`);
  }

  const text = "Good day, Saket. " + parts.join(" ") + " All feeds nominal.";
  log("ok", "[BRIEF]", parts.length + " sections compiled");
  if (voice) speak(text);
  else log("sys", "[BRIEF]", text);
  return text;
}

/* ---- commands ---- */
async function handleCommand(raw) {
  const q = raw.trim().toLowerCase().replace(/^(hey |ok |okay )?(ada|world)[, ]*/, "");
  if (!q) return;
  log("user", "[OP]", raw.trim());

  if (/^(help|commands)/.test(q)) {
    respond("Commands: briefing, quakes, news, bitcoin, launches, weather <city>, iss, space weather, refresh. Say ADA first for voice.");
  } else if (/brief|morning|situation|summary/.test(q)) {
    morningBriefing(true);
  } else if (/quake|seismic|earthquake/.test(q)) {
    if (S.quakes.length) {
      const top = S.quakes.slice(0, 3);
      respond(`Top seismic events: ` + top.map((t) => `Magnitude ${t.mag}, ${t.place}, ${ago(t.time)}`).join(". ") + ".");
    } else respond("Seismic feed still syncing.", false);
  } else if (/bitcoin|btc|crypto|market|ethereum|solana/.test(q)) {
    const btc = S.crypto.find((c) => c.id === "bitcoin");
    const eth = S.crypto.find((c) => c.id === "ethereum");
    if (btc) respond(`Bitcoin $${Math.round(btc.usd).toLocaleString("en-IN")}${btc.chg != null ? ", " + (btc.chg >= 0 ? "up" : "down") + " " + Math.abs(btc.chg).toFixed(1) + " percent" : ""}. Ethereum $${eth ? Math.round(eth.usd).toLocaleString("en-IN") : "--"}.`);
    else respond("Market feed syncing.", false);
  } else if (/launch|rocket|spacex|launches/.test(q)) {
    if (S.launches.length) {
      const l = S.launches[0];
      respond(`Next launch: ${l.name}, by ${l.provider || "unknown provider"}. Status: ${l.status}.`);
    } else respond("Launch feed syncing.", false);
  } else if (/weather|temperature|climate/.test(q)) {
    const m = q.match(/(?:weather|in)\s+([a-z\s]+)$/);
    const city = m ? m[1].trim() : null;
    if (city) {
      try {
        const g = await API.geo(city);
        if (!g) { respond(`I could not locate ${city}.`, false); return; }
        const w = await API.weather(g.lat, g.lon);
        respond(`${g.name}: ${w.temp.toFixed(0)} degrees, ${WMO[w.code] || "current conditions"}, wind ${Math.round(w.wind)} kilometers per hour.`);
      } catch (e) { respond("Weather link failed.", false); }
    } else if (S.climate) {
      respond(`Delhi: ${S.climate.temp.toFixed(0)} degrees, ${WMO[S.climate.code] || "current conditions"}${S.climate.aqi != null ? ", AQI " + S.climate.aqi : ""}.`);
    } else respond("Climate feed syncing.", false);
  } else if (/\biss\b|station/.test(q)) {
    if (S.issNow) respond(`ISS is at ${S.issNow.lat.toFixed(1)} north, ${S.issNow.lon.toFixed(1)} ${S.issNow.lon >= 0 ? "east" : "west"}, altitude ${Math.round(S.issNow.alt)} kilometers, speed ${Math.round(S.issNow.vel)} kilometers per hour.`);
    else respond("ISS link syncing.", false);
  } else if (/space weather|kp|solar|geomag|storm/.test(q)) {
    if (S.kp.length) {
      const last = S.kp[S.kp.length - 1];
      respond(`Geomagnetic Kp at ${last.kp.toFixed(1)} — ${kpLabel(last.kp).toLowerCase()} conditions.`);
    } else respond("Space weather syncing.", false);
  } else if (/news|headline|world/.test(q)) {
    if (S.news.world.length) {
      respond("Top stories: " + S.news.world.slice(0, 3).map((n) => n.title).join(". ") + ".");
    } else respond("News feed syncing.", false);
  } else if (/refresh|update|sync/.test(q)) {
    respond("Refreshing all feeds.", false);
    refreshAll();
  } else if (/hello|hi\b|hey/.test(q)) {
    respond("Hello Saket. All monitoring feeds operational.");
  } else if (/who are you|your name/.test(q)) {
    respond("I am ADA World Monitor — your global intelligence co-pilot, named for Ada Lovelace.");
  } else if (/thank/.test(q)) {
    respond("Always a pleasure.");
  } else if (/mute|quiet|silence/.test(q)) {
    ttsOn = false; $("#tts-state").textContent = "TTS OFF"; speechSynthesis.cancel(); log("sys", "[SYS]", "voice muted");
  } else if (/speak|unmute|voice on/.test(q)) {
    ttsOn = true; $("#tts-state").textContent = "TTS ON"; respond("Voice enabled.");
  } else {
    respond("Command not recognized. Say help for options.");
  }
}

function toggleVoice() {
  if (!SR) { log("warn", "[SYS]", "speech recognition not supported here — text terminal works"); return; }
  if (listening) { try { recog.stop(); } catch (_) { } return; }
  recog = new SR();
  recog.lang = "en-IN"; recog.interimResults = false; recog.maxAlternatives = 1;
  recog.onstart = () => { listening = true; $("#voice-btn").classList.add("listening"); $("#voice-btn").textContent = "■ Listening…"; $("#comms-mode").textContent = "LISTENING"; log("sys", "[SYS]", "voice link open"); };
  recog.onresult = (e) => handleCommand(e.results[0][0].transcript);
  recog.onerror = (e) => { if (e.error !== "no-speech") log("warn", "[SYS]", "voice error: " + e.error); };
  recog.onend = () => { listening = false; $("#voice-btn").classList.remove("listening"); $("#voice-btn").textContent = "▸ Activate Voice Link"; if (!speaking) $("#comms-mode").textContent = "STANDBY"; };
  try { recog.start(); } catch (e) { }
}

$("#voice-btn").addEventListener("click", toggleVoice);
$("#brief-btn").addEventListener("click", () => morningBriefing(true));
$("#cmd").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.value.trim()) { handleCommand(e.target.value); e.target.value = ""; }
});
document.addEventListener("keydown", (e) => {
  if (e.target === $("#cmd")) return;
  const k = e.key.toLowerCase();
  if (k === "v") toggleVoice();
  else if (k === "b") morningBriefing(true);
  else if (k === "s") { log("sys", "[SYS]", "manual scan"); refreshQuakes(); }
  else if (k === "r") refreshAll();
  else if (k === "m") { ttsOn = !ttsOn; $("#tts-state").textContent = ttsOn ? "TTS ON" : "TTS OFF"; speechSynthesis.cancel(); }
  else if (k === "/") { e.preventDefault(); $("#cmd").focus(); }
});

/* ================= boot ================= */
const BOOT = [
  ["ADA WORLD MONITOR v1.0 — cold start", false],
  ["> linking USGS seismic network ....... <b>OK</b>", true],
  ["> acquiring ISS telemetry (25544) .... <b>OK</b>", true],
  ["> NOAA space weather (Kp index) ..... <b>OK</b>", true],
  ["> market + climate + news relays ..... <b>OK</b>", true],
  ["> voice matrix calibrated ............ <b>OK</b>", true],
  ["<b>ALL FEEDS NOMINAL — WELCOME, SAKET</b>", true],
];
function runBoot(cb) {
  const box = $("#boot-lines");
  let i = 0;
  const iv = setInterval(() => {
    if (i >= BOOT.length) {
      clearInterval(iv);
      setTimeout(() => { $("#boot").classList.add("gone"); setTimeout(() => $("#boot").remove(), 700); cb && cb(); }, 400);
      return;
    }
    const d = document.createElement("div");
    d.className = "b-line";
    d.innerHTML = BOOT[i][0] + (i === BOOT.length - 1 ? ' <span class="cursor"></span>' : "");
    box.appendChild(d);
    i++;
  }, 280);
  $("#boot").addEventListener("click", () => { clearInterval(iv); i = BOOT.length; });
}

/* ================= main loop ================= */
function frame(now) { drawWave(now); requestAnimationFrame(frame); }

window.addEventListener("resize", sizeWave);
if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = () => { };
  speechSynthesis.getVoices();
}
// prime TTS on first interaction (autoplay policy)
const prime = () => { const u = new SpeechSynthesisUtterance(""); u.volume = 0; speechSynthesis.speak(u); document.removeEventListener("click", prime); document.removeEventListener("keydown", prime); };
document.addEventListener("click", prime);
document.addEventListener("keydown", prime);

initMap();
bindToggles();
sizeWave();
runBoot(() => {
  log("ok", "[SYS]", "ADA World Monitor online · 8 feeds armed");
  log("sys", "[SYS]", "HELP for commands · B for briefing · V for voice");
  refreshAll();
  setInterval(refreshAll, 120000);
  setInterval(refreshISS, 15000);
});
requestAnimationFrame(frame);
