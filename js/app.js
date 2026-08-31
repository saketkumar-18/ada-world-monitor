/* ADA World Monitor v3 — worldmonitor.app-style app.
 * Live news (YouTube 24/7 streams), webcams, DEFCON, tickers,
 * dark globe + flat map, AI co-pilot chat, all real data.
 */
"use strict";

/* ================= state ================= */
const S = {
  quakes: [], issTrail: [], issNow: null, kp: [], crypto: [],
  news: { world: [], tech: [] }, launches: [], climate: null,
  live: 0, layerOn: { quakes: true, iss: true, choke: true, flights: true, sats: true, conflict: true },
  scanCenter: { lat: 28.61, lon: 77.23, name: "DELHI" },
  defcon: 5,
};

/* worldmonitor-style news channels — YouTube 24/7 live embeds (no key needed) */
const CHANNELS = [
  { id: "aljazeera", name: "ALJAZEERA", vid: "gCNeDWCI0vo" },
  { id: "bloomberg", name: "BLOOMBERG", vid: "iEpJwprxDdk" },
  { id: "sky", name: "SKYNEWS", vid: "uvviIF4725I" },
  { id: "euronews", name: "EURONEWS", vid: "pykpO5kQJ98" },
  { id: "dw", name: "DW", vid: "LuKwFajn37U" },
  { id: "cnbc", name: "CNBC", vid: "9NyxcX3rhQs" },
  { id: "cnn", name: "CNN", vid: "w_Ma8oQLmSM" },
  { id: "france24", name: "FRANCE 24", vid: "u9foWyMSETk" },
];
let curChannel = "aljazeera";

/* worldmonitor-style webcams (verified live skylinewebcams snapshots, no key) */
const WEBCAMS = [
  { name: "TIMES SQ · NYC", img: "https://cdn.skylinewebcams.com/live544.jpg?" },
  { name: "LONDON EYE", img: "https://cdn.skylinewebcams.com/live1045.jpg?" },
  { name: "DUBAI MARINA", img: "https://cdn.skylinewebcams.com/live992.jpg?" },
];

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const T0 = Date.now();
const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
};

/* ================= boot ================= */
const BOOT = [
  ["ADA WORLD MONITOR v3.0 — cold start", false],
  ["> global map engine ............ <b>OK</b>", true],
  ["> live news streams (8 ch) ...... <b>OK</b>", true],
  ["> flight radar (ADS-B) .......... <b>OK</b>", true],
  ["> starlink constellation ....... <b>OK</b>", true],
  ["> seismic + space weather ...... <b>OK</b>", true],
  ["> ai co-pilot armed ............ <b>OK</b>", true],
  ["<b>SITUATIONAL AWARENESS ONLINE — WELCOME SAKET</b>", true],
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
  }, 260);
  $("#boot").addEventListener("click", () => { clearInterval(iv); i = BOOT.length; });
}

/* ================= chat UI ================= */
const chatLog = $("#chat-log");
function chatMsg(text, who = "ada") {
  const el = document.createElement("div");
  el.className = "msg " + who;
  el.textContent = text;
  chatLog.appendChild(el);
  while (chatLog.children.length > 60) chatLog.removeChild(chatLog.firstChild);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}
function chatThinking() {
  const el = document.createElement("div");
  el.className = "msg ada thinking";
  el.textContent = "soch rahi hoon…";
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

/* ================= clocks (UTC + IST like worldmonitor) ================= */
setInterval(() => {
  const now = new Date();
  const utc = now.toISOString();
  $("#clock").textContent = utc.slice(11, 19);
  $("#dateline").textContent = utc.slice(0, 10).replace(/-/g, " ") + " · UTC";
  $("#map-stamp").textContent = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getUTCDay()] + ", " +
    utc.slice(0, 10).split("-").reverse().join(" ") + " " + utc.slice(11, 19) + " UTC";
  $("#bt-utc").textContent = utc.slice(11, 16);
  $("#bt-ist").textContent = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}, 500);

/* ================= news panel ================= */
function buildNewsTabs() {
  const box = $("#news-tabs");
  CHANNELS.forEach((c) => {
    const b = document.createElement("button");
    b.className = "ntab" + (c.id === curChannel ? " on" : "");
    b.textContent = c.name;
    b.addEventListener("click", () => switchChannel(c.id));
    box.appendChild(b);
  });
}
function switchChannel(id) {
  curChannel = id;
  document.querySelectorAll(".ntab").forEach(t => t.classList.toggle("on", t.textContent === CHANNELS.find(c => c.id === id).name));
  const c = CHANNELS.find(c => c.id === id);
  // YouTube live embed — free, no API
  $("#news-iframe").src = `https://www.youtube.com/embed/${c.vid}?autoplay=1&mute=1&modestbranding=1&rel=0`;
  $("#news-status").textContent = "● " + c.name;
}
function renderHeadlines() {
  const box = $("#news-headlines");
  box.innerHTML = "";
  S.news.world.slice(0, 14).forEach((n) => {
    const el = document.createElement("div");
    el.className = "hl";
    el.innerHTML = `<span class="src">BBC</span><a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>`;
    box.appendChild(el);
  });
  if (!S.news.world.length) box.innerHTML = '<div class="hl" style="color:var(--dim)">headlines sync…</div>';
}

/* ================= webcams ================= */
function buildCams() {
  const box = $("#cams-row");
  WEBCAMS.forEach((w) => {
    const d = document.createElement("div");
    d.className = "cam";
    const stamp = Date.now();
    d.innerHTML = `<img src="${w.img}${stamp}" alt="${w.name}" loading="lazy" onerror="this.style.opacity=.15">
      <div class="cam-label">${w.name} · LIVE</div>`;
    box.appendChild(d);
  });
  // refresh cam images every 2 min
  setInterval(() => {
    document.querySelectorAll(".cam img").forEach((img, i) => {
      if (WEBCAMS[i]) img.src = WEBCAMS[i].img + Date.now();
    });
  }, 120000);
}

/* ================= DEFCON (from live data) ================= */
function computeDefcon() {
  let d = 5;
  const m5 = S.quakes.filter(q => q.mag >= 6.2).length;
  const kp = S.kp.length ? S.kp[S.kp.length - 1].kp : 0;
  const warWords = S.news.world.filter(n => /war|attack|missile|strike|nuclear|invasion/i.test(n.title)).length;
  if (m5 >= 1) d = Math.min(d, 4);
  if (warWords >= 2) d = Math.min(d, 3);
  if (kp >= 7) d = Math.min(d, 3);
  if (warWords >= 4) d = Math.min(d, 2);
  S.defcon = d;
  const el = $("#defcon-val");
  el.textContent = d;
  el.style.color = d <= 2 ? "var(--red)" : d === 3 ? "var(--orange)" : "var(--green)";
}

/* ================= map (globe + leaflet) ================= */
let map = null, layerQuakes = null, layerISS = null, issPath = null, layerConflict = null;
let useGlobe = true;

const CONFLICT_ZONES = [
  { name: "Ukraine", lat: 49.0, lon: 31.4, r: 500000 },
  { name: "Israel/Gaza", lat: 31.4, lon: 34.3, r: 200000 },
  { name: "Syria", lat: 35.0, lon: 38.5, r: 300000 },
  { name: "Yemen", lat: 15.5, lon: 44.2, r: 300000 },
  { name: "Sudan", lat: 15.5, lon: 32.5, r: 400000 },
  { name: "Sahel", lat: 14.5, lon: 1.0, r: 600000 },
  { name: "Myanmar", lat: 20.5, lon: 96.5, r: 350000 },
];

function initMap() {
  if (typeof L === "undefined") return;
  try {
    map = L.map("map", { worldCopyJump: true, zoomControl: false }).setView([25, 35], 2);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
    layerQuakes = L.layerGroup();
    layerISS = L.layerGroup();
    layerConflict = L.layerGroup();
    issPath = L.polyline([], { className: "iss-path", dashArray: "4 3" });
    renderConflict();
    window.__adaMap = { map };
    window.__adaLayers = (key, on) => { S.layerOn[key] = on; applyLayers(); return { layer: key, on }; };
  } catch (e) { map = null; }
}
function applyLayers() {
  if (!map) return;
  S.layerOn.quakes && layerQuakes ? layerQuakes.addTo(map) : layerQuakes && map.removeLayer(layerQuakes);
  S.layerOn.iss && layerISS ? layerISS.addTo(map) : layerISS && map.removeLayer(layerISS);
  S.layerOn.conflict && layerConflict ? layerConflict.addTo(map) : layerConflict && map.removeLayer(layerConflict);
}
function renderConflict() {
  if (!map || !layerConflict) return;
  layerConflict.clearLayers();
  CONFLICT_ZONES.forEach((z) => {
    layerConflict.addLayer(L.circle([z.lat, z.lon], {
      radius: z.r, color: "#ff4d5e", weight: 1, fillColor: "#ff4d5e", fillOpacity: 0.12, dashArray: "3 4",
    }).bindPopup(`<b style="color:#ff4d5e">${z.name}</b><br><span style="color:#8494a8">conflict zone — monitoring</span>`));
  });
}
function renderMapQuakes() {
  if (!map || !layerQuakes) return;
  layerQuakes.clearLayers();
  S.quakes.slice(0, 120).forEach((q) => {
    const r = Math.max(4, Math.min(20, (q.mag || 0) * 3.4));
    const big = q.mag >= 5;
    layerQuakes.addLayer(L.circleMarker([q.lat, q.lon], {
      radius: r / 2, className: "quake-dot" + (big ? " big" : ""), fillOpacity: 0.8, color: "#000", weight: 1,
    }).bindPopup(`<b style="color:${big ? "#ff4d5e" : "#ff9840"}">M ${q.mag}</b> ${q.place}<br><span style="color:#8494a8">${ago(q.time) * 1}m ago · ${Math.round(q.depth)} km deep</span>`));
  });
}
function renderMapISS() {
  if (!map || !layerISS) return;
  layerISS.clearLayers();
  if (S.issNow) {
    layerISS.addLayer(L.marker([S.issNow.lat, S.issNow.lon], { icon: L.divIcon({ className: "iss-icon", iconSize: [10, 10], html: "" }) })
      .bindPopup(`<b style="color:#38d9f9">ISS</b> · ${Math.round(S.issNow.alt)} km · ${Math.round(S.issNow.vel)} km/h`));
    if (S.issTrail.length > 1) issPath.setLatLngs(S.issTrail.map(p => [p.lat, p.lon])).addTo(layerISS);
    $("#iss-hud").innerHTML = `ISS <b>${S.issNow.lat.toFixed(1)}° ${S.issNow.lon.toFixed(1)}°</b> · ${Math.round(S.issNow.alt)} km`;
  }
}

/* globe */
function initGlobe() {
  const ok = GODSEYE.init("globe", (lat, lng) => {
    S.scanCenter = { lat: +lat.toFixed(2), lon: +lng.toFixed(2), name: "SCAN" };
    $("#scan-region").textContent = lat.toFixed(1) + "N " + lng.toFixed(1) + "E";
  });
  useGlobe = ok;
  if (!ok) {
    $("#globe").style.display = "none";
    $("#map").style.display = "block";
    if (!map) initMap();
    $("#btn-globe").classList.remove("on"); $("#btn-flat").classList.add("on");
  }
  return ok;
}
function syncGlobeData() {
  if (!useGlobe) return;
  GODSEYE.state.quakes = S.quakes.slice(0, 60);
  GODSEYE.renderQuakes(); GODSEYE.renderFlights(); GODSEYE.renderSats();
}

/* ================= intel counts + tickers ================= */
function updateCounts() {
  const c = useGlobe ? GODSEYE.counts() : { flights: 0, milFlights: 0, sats: 0, totalSats: 0 };
  $("#c-quakes").textContent = S.quakes.length;
  $("#c-mil").textContent = c.milFlights || 0;
  $("#c-flights").textContent = c.flights || 0;
  $("#c-sats").textContent = c.sats || 0;
  $("#c-m5").textContent = S.quakes.filter(q => q.mag >= 5).length;
  if (S.kp.length) $("#c-kp").textContent = S.kp[S.kp.length - 1].kp.toFixed(1);
}
function buildTicker() {
  const parts = [];
  S.news.world.slice(0, 8).forEach(n => parts.push("⚡ " + n.title.slice(0, 90)));
  if (S.crypto.length) {
    S.crypto.forEach(c => {
      const nm = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL" }[c.id] || c.id.toUpperCase();
      parts.push(`${nm} $${Math.round(c.usd).toLocaleString("en-IN")} ${c.chg != null ? (c.chg >= 0 ? "▲" : "▼") + Math.abs(c.chg).toFixed(1) + "%" : ""}`);
    });
  }
  if (S.quakes.length) parts.push(`🌍 M${S.quakes[0].mag} ${S.quakes[0].place.slice(0, 40)}`);
  const html = parts.join("&nbsp;&nbsp;·&nbsp;&nbsp;");
  $("#bt-ticker-inner").innerHTML = html + "&nbsp;&nbsp;·&nbsp;&nbsp;" + html;
  $("#ticker-inner").innerHTML = html + "&nbsp;&nbsp;·&nbsp;&nbsp;" + html;
}

/* ================= feeds ================= */
let liveFeeds = 0;
function bumpLive() { liveFeeds++; }
async function refreshQuakes() {
  try { S.quakes = await API.quakes(); renderMapQuakes(); syncGlobeData(); bumpLive(); } catch (e) { }
}
async function refreshISS() {
  try {
    const p = await API.iss();
    S.issNow = p;
    S.issTrail.push({ lat: p.lat, lon: p.lon });
    if (S.issTrail.length > 200) S.issTrail.shift();
    renderMapISS();
    if (useGlobe) { GODSEYE.state.iss = { lat: p.lat, lon: p.lon, alt: p.alt }; GODSEYE.state.issPath = S.issTrail.slice(-60); GODSEYE.renderISS(); }
  } catch (e) { $("#iss-hud").textContent = "ISS: LINK LOST"; }
}
async function refreshKp() { try { S.kp = await API.kp(); bumpLive(); } catch (e) { } }
async function refreshCrypto() {
  try {
    S.crypto = await API.crypto();
    const btc = S.crypto.find(c => c.id === "bitcoin"), eth = S.crypto.find(c => c.id === "ethereum");
    if (btc) $("#bt-btc").textContent = "$" + Math.round(btc.usd).toLocaleString("en-IN");
    if (eth) $("#bt-eth").textContent = "$" + Math.round(eth.usd).toLocaleString("en-IN");
    bumpLive();
  } catch (e) { }
}
async function refreshFX() {
  try {
    const r = await AI.fx("USD", "INR");
    $("#bt-fx").textContent = r.rates.INR.toFixed(2);
  } catch (e) { }
}
async function refreshAQI() {
  try {
    const aq = await API.airquality(28.61, 77.23);
    $("#bt-aqi").textContent = aq.aqi ?? "--";
    S.climate = { ...S.climate, aqi: aq.aqi };
  } catch (e) { }
}
async function refreshNews() {
  try { S.news.world = await API.worldNews(14); renderHeadlines(); bumpLive(); } catch (e) { }
}
async function refreshFlights() {
  await GODSEYE.fetchFlights(S.scanCenter.lat, S.scanCenter.lon);
  await GODSEYE.fetchMilFlights(S.scanCenter.lat, S.scanCenter.lon);
  syncGlobeData();
}
async function refreshSats() {
  if (await GODSEYE.fetchTLEs()) { GODSEYE.propagateSats(); syncGlobeData(); }
}
async function refreshAll() {
  liveFeeds = 0;
  await Promise.allSettled([refreshQuakes(), refreshISS(), refreshKp(), refreshCrypto(), refreshNews(), refreshFlights(), refreshFX(), refreshAQI()]);
  updateCounts(); computeDefcon(); buildTicker();
}

/* ================= voice + speak (with mic-reopen fix) ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false, ttsOn = true, speaking = false, voiceLoop = false;
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
    wctx.fillStyle = active ? (listening ? "rgba(255,77,94,.9)" : "rgba(56,217,249,.9)") : "rgba(84,104,124,.4)";
    wctx.fillRect(i * bw + 1, (H - h) / 2, bw - 2, h);
  }
}
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  const byLang = (l) => vs.filter(v => v.lang.replace("_", "-").toLowerCase().startsWith(l.toLowerCase()));
  const female = (arr) => arr.find(v => /female|zira|heera|neerja|sonia|libby|swara|google|kalpana|madhuri/i.test(v.name));
  const pool = byLang(convo.lastLang || "en-IN");
  if (pool.length) return female(pool) || pool[0];
  const fam = byLang((convo.lastLang || "en-IN").split("-")[0]);
  if (fam.length) return female(fam) || fam[0];
  const en = byLang("en");
  return female(en) || en[0] || vs[0];
}
function speak(text) {
  if (!ttsOn || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02; u.pitch = 1; u.volume = 1; u.lang = convo.lastLang || "en-IN";
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; }
  u.onstart = () => { speaking = true; $("#comms-mode").textContent = "BOL RAHI HOON"; };
  u.onend = () => {
    speaking = false; $("#comms-mode").textContent = listening ? "SUN RAHI HOON" : "STANDBY";
    if (voiceLoop && !listening && !convo.busy) {
      setTimeout(() => { if (voiceLoop && !listening && !speaking && !convo.busy) toggleVoice(); }, 600);
    }
  };
  u.onerror = () => {
    speaking = false; $("#comms-mode").textContent = "STANDBY";
    if (voiceLoop && !listening && !convo.busy) {
      setTimeout(() => { if (voiceLoop && !listening && !speaking && !convo.busy) toggleVoice(); }, 600);
    }
  };
  speechSynthesis.speak(u);
}
function cleanForSpeech(t) {
  return String(t)
    .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1").replace(/^#{1,4}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[_~|>#]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
function respond(text, sayIt = true) {
  const clean = cleanForSpeech(text);
  chatMsg(clean, "ada");
  if (sayIt) speak(clean);
}
function log() { } // compat

function toggleVoice() {
  if (!SR) { chatMsg("is browser me voice support nahi — Chrome/Edge use karo", "ada"); return; }
  if (listening) { try { recog.stop(); } catch (_) { } return; }
  recog = new SR();
  recog.lang = convo.lastLang || "en-IN";
  recog.interimResults = false; recog.maxAlternatives = 1;
  recog.onstart = () => { listening = true; $("#voice-btn").classList.add("listening"); $("#voice-btn").textContent = "■ SUN RAHI HOON"; $("#comms-mode").textContent = "SUN RAHI HOON"; };
  recog.onresult = async (e) => {
    const t = e.results[0][0].transcript;
    convo.lastLang = detectLang(t);
    chatMsg(t, "user");
    const th = chatThinking();
    try { await handleCommand(t); } catch (err) { chatMsg("technical gadbad — phir se bolo", "ada"); }
    th.remove();
  };
  recog.onerror = (e) => { if (e.error !== "no-speech") chatMsg("voice error: " + e.error, "ada"); };
  recog.onend = () => {
    listening = false; $("#voice-btn").classList.remove("listening"); $("#voice-btn").textContent = "▸ VOICE ON (V)";
    if (!speaking) $("#comms-mode").textContent = "STANDBY";
    if (voiceLoop && !speaking && !convo.busy) {
      setTimeout(() => { if (voiceLoop && !listening && !speaking && !convo.busy) toggleVoice(); }, 800);
    }
  };
  try { recog.start(); } catch (e) { }
}

/* ================= input wiring ================= */
async function sendChat() {
  const inp = $("#chat-in");
  const v = inp.value.trim();
  if (!v) return;
  inp.value = "";
  chatMsg(v, "user");
  const th = chatThinking();
  try { await handleCommand(v); }
  catch (e) { chatMsg("kuch gadbad ho gayi — phir try karo", "ada"); }
  th.remove();
}
$("#chat-send").addEventListener("click", sendChat);
$("#chat-in").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });
$("#voice-btn").addEventListener("click", () => { voiceLoop = !voiceLoop; toggleVoice(); });
document.querySelectorAll("#chat-chips .qchip").forEach(c => {
  c.addEventListener("click", () => { $("#chat-in").value = c.textContent; sendChat(); });
});
document.addEventListener("keydown", (e) => {
  if (e.target === $("#chat-in")) return;
  const k = e.key.toLowerCase();
  if (k === "v") { voiceLoop = !voiceLoop; toggleVoice(); }
  else if (k === "m") { ttsOn = !ttsOn; $("#tts-state").textContent = ttsOn ? "TTS ON" : "TTS OFF"; speechSynthesis.cancel(); }
  else if (k === "l") GODSEYE.flyTo(S.scanCenter.lat, S.scanCenter.lon, 0.9);
  else if (k === "/") { e.preventDefault(); $("#chat-in").focus(); }
});

/* ================= view + zoom ================= */
$("#btn-globe").addEventListener("click", () => {
  if (!useGlobe) {
    useGlobe = true;
    $("#globe").style.display = "block"; $("#map").style.display = "none";
    $("#btn-globe").classList.add("on"); $("#btn-flat").classList.remove("on");
    syncGlobeData();
  }
});
$("#btn-flat").addEventListener("click", () => {
  useGlobe = false;
  $("#globe").style.display = "none"; $("#map").style.display = "block";
  $("#btn-flat").classList.add("on"); $("#btn-globe").classList.remove("on");
  if (!map) initMap();
  renderMapQuakes(); renderMapISS(); applyLayers();
  setTimeout(() => { if (map) map.invalidateSize(); }, 100);
});
let autoRotate = true, rotTimer = null;
function setAutoRotate(on) {
  autoRotate = on;
  $("#zoom-rot").classList.toggle("rot-on", on);
  if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
  if (on && useGlobe && GODSEYE.ready()) {
    GODSEYE.setAutoRotateOK(true);
    rotTimer = setInterval(() => { try { GODSEYE.rotate(); } catch (e) { } }, 60);
  } else GODSEYE.setAutoRotateOK(false);
}
$("#zoom-in").addEventListener("click", () => { useGlobe && GODSEYE.ready() ? GODSEYE.zoom(-0.4) : map && map.zoomIn(); });
$("#zoom-out").addEventListener("click", () => { useGlobe && GODSEYE.ready() ? GODSEYE.zoom(0.4) : map && map.zoomOut(); });
$("#zoom-home").addEventListener("click", () => { useGlobe && GODSEYE.ready() ? GODSEYE.flyTo(25, 40, 2.2) : map && map.setView([25, 40], 2); });
$("#zoom-rot").addEventListener("click", () => setAutoRotate(!autoRotate));

/* layer buttons */
document.querySelectorAll("#layers-btns .lbtn").forEach(b => {
  b.addEventListener("click", () => {
    const key = b.dataset.layer;
    const on = !b.classList.contains("on");
    b.classList.toggle("on", on);
    if (key === "quakes") { S.layerOn.quakes = on; GODSEYE.setLayer("quakes", on); renderMapQuakes(); applyLayers(); }
    if (key === "flights") GODSEYE.setLayer("flights", on);
    if (key === "sats") GODSEYE.setLayer("sats", on);
    if (key === "iss") { S.layerOn.iss = on; GODSEYE.setLayer("iss", on); renderMapISS(); applyLayers(); }
    if (key === "conflict") { S.layerOn.conflict = on; renderConflict(); applyLayers(); }
  });
});

/* ================= OS bridge chip ================= */
async function pollBridge() {
  try {
    const r = await fetch("http://127.0.0.1:8742/status", { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
    const j = await r.json();
    if (j.error || !j.alive) throw 0;
    $("#os-label").textContent = "OS ARMED";
    $("#os-led").className = "led ok";
  } catch (e) {
    $("#os-label").textContent = "OS OFFLINE";
    $("#os-led").className = "led warn";
  }
}

/* ================= main ================= */
function frame(now) { drawWave(now); requestAnimationFrame(frame); }
window.addEventListener("resize", sizeWave);
if ("speechSynthesis" in window) { speechSynthesis.onvoiceschanged = () => { }; speechSynthesis.getVoices(); }
const prime = () => { const u = new SpeechSynthesisUtterance(""); u.volume = 0; speechSynthesis.speak(u); document.removeEventListener("click", prime); document.removeEventListener("keydown", prime); };
document.addEventListener("click", prime); document.addEventListener("keydown", prime);
window.addEventListener("error", e => { try { chatMsg("error: " + (e.message || e.type), "ada"); } catch (_) { } });

initMap();
initGlobe();
buildNewsTabs();
switchChannel("aljazeera");
buildCams();
sizeWave();
pollBridge();
setInterval(pollBridge, 30000);
runBoot(() => {
  refreshAll();
  refreshSats();
  setAutoRotate(true);
  const gEl = $("#globe");
  if (gEl) ["mousedown", "wheel", "touchstart"].forEach(ev => gEl.addEventListener(ev, () => { GODSEYE.setAutoRotateOK(false); }, { once: true, passive: true }));
  setInterval(refreshAll, 120000);
  setInterval(refreshISS, 15000);
  setInterval(() => { if (useGlobe) { GODSEYE.propagateSats(); GODSEYE.renderSats(); updateCounts(); } }, 30000);
  setInterval(() => { GODSEYE.fetchFlights(S.scanCenter.lat, S.scanCenter.lon).then(syncGlobeData); }, 60000);
});
requestAnimationFrame(frame);
