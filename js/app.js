/* ADA God's Eye — main app.
 * 3D globe + live flights/sats + natural-language AI chat (human style).
 */
"use strict";

/* ================= state ================= */
const S = {
  quakes: [], issTrail: [], issNow: null, kp: [], crypto: [],
  news: { world: [], tech: [], wiki: [] }, launches: [], hn: [],
  climate: null, live: 0, layerOn: { quakes: true, iss: true, choke: true },
  scanCenter: { lat: 28.61, lon: 77.23, name: "DELHI" },
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

/* ================= clock ================= */
setInterval(() => {
  $("#clock").textContent = fmtTime();
  $("#dateline").textContent = fmtDate() + " · IST";
  const s = Math.floor((Date.now() - T0) / 1000);
}, 500);

/* ================= globe + fallback map ================= */
let map = null, layerQuakes = null, layerISS = null, layerChoke = null, issPath = null;
let useGlobe = true;

function initMap() {
  if (typeof L === "undefined") return;
  try {
    map = L.map("map", { worldCopyJump: true, zoomControl: false }).setView([25, 40], 2);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
    layerChoke = L.layerGroup();
    GODSEYE.CHOKE.forEach(([n, lat, lon]) => {
      layerChoke.addLayer(L.marker([lat, lon], { icon: L.divIcon({ className: "choke-icon", iconSize: [8, 8], html: "" }) })
        .bindPopup(`<b style="color:#ff4d5e">${n}</b>`));
    });
    layerQuakes = L.layerGroup();
    layerISS = L.layerGroup();
    issPath = L.polyline([], { className: "iss-path", color: "#35e0ff", weight: 1.5, dashArray: "4 3", opacity: 0.5 });
    layerOn.choke && layerChoke.addTo(map);
    layerOn.quakes && layerQuakes.addTo(map);
    layerOn.iss && layerISS.addTo(map);
    window.__adaMap = { map };
    window.__adaLayers = (key, on) => {
      S.layerOn[key] = on; applyLayers(); return { layer: key, on };
    };
  } catch (e) { map = null; }
}
function applyLayers() {
  if (!map) return;
  S.layerOn.quakes ? layerQuakes.addTo(map) : map.removeLayer(layerQuakes);
  S.layerOn.iss ? layerISS.addTo(map) : map.removeLayer(layerISS);
  S.layerOn.choke ? layerChoke.addTo(map) : map.removeLayer(layerChoke);
}
function renderMapQuakes() {
  if (!map || !layerQuakes) return;
  layerQuakes.clearLayers();
  S.quakes.slice(0, 120).forEach((q) => {
    const r = Math.max(4, Math.min(18, (q.mag || 0) * 3.2));
    const big = q.mag >= 5;
    layerQuakes.addLayer(L.circleMarker([q.lat, q.lon], {
      radius: r / 2, className: "quake-dot" + (big ? " big" : ""), fillColor: big ? "#ff4d5e" : "#ffb454",
      fillOpacity: 0.75, color: "#000", weight: 1,
    }).bindPopup(`<b style="color:${big ? "#ff4d5e" : "#ffb454"}">M ${q.mag}</b> ${q.place}<br><span style="color:#54687c">${ago(q.time)} · </span><a href="${q.url}" target="_blank" style="color:#35e0ff">USGS ↗</a>`));
  });
}
function renderMapISS() {
  if (!map || !layerISS) return;
  layerISS.clearLayers();
  if (S.issNow) {
    layerISS.addLayer(L.marker([S.issNow.lat, S.issNow.lon], { icon: L.divIcon({ className: "iss-icon", iconSize: [10, 10], html: "" }) })
      .bindPopup(`<b style="color:#35e0ff">ISS</b> · alt ${Math.round(S.issNow.alt)} km`));
    if (S.issTrail.length > 1) issPath.setLatLngs(S.issTrail.map((p) => [p.lat, p.lon])).addTo(layerISS);
    $("#iss-hud").innerHTML = `ISS: <b>${S.issNow.lat.toFixed(1)}°, ${S.issNow.lon.toFixed(1)}°</b> · ${Math.round(S.issNow.alt)} km`;
  }
}

/* ================= god's eye globe ================= */
function initGlobe() {
  const ok = GODSEYE.init("globe", (lat, lng) => {
    S.scanCenter = { lat: +lat.toFixed(2), lon: +lng.toFixed(2), name: "CUSTOM" };
    $("#loc-label").textContent = `${S.scanCenter.lat}N ${S.scanCenter.lon}E · SCAN`;
  });
  useGlobe = ok;
  $("#hud-mode").textContent = ok ? "3D GLOBE" : "2D MAP";
  return ok;
}
function syncGlobeData() {
  if (!useGlobe) return;
  GODSEYE.state.quakes = S.quakes.slice(0, 60).map(q => ({ mag: q.mag, place: q.place, lat: q.lat, lon: q.lon, time: q.time }));
  GODSEYE.renderQuakes();
  GODSEYE.renderFlights();
  GODSEYE.renderSats();
}
function updateCounts() {
  const c = useGlobe ? GODSEYE.counts() : { flights: 0, milFlights: 0, sats: 0, totalSats: 0, quakes: S.quakes.length };
  $("#c-flights").textContent = c.flights;
  $("#c-mil").textContent = c.milFlights;
  $("#c-quakes").textContent = S.quakes.length;
  $("#c-sats").textContent = c.totalSats > 0 ? c.sats + "/" + c.totalSats : c.sats;
  if (S.kp.length) $("#c-kp").textContent = S.kp[S.kp.length - 1].kp.toFixed(1);
}

/* ================= feeds ================= */
let liveFeeds = 0;
function bumpLive() { liveFeeds++; $("#live-count").textContent = liveFeeds + " FEEDS"; }

async function refreshQuakes() {
  try { S.quakes = await API.quakes(); renderMapQuakes(); syncGlobeData(); bumpLive(); } catch (e) { }
}
async function refreshISS() {
  try {
    const p = await API.iss();
    S.issNow = p;
    S.issTrail.push({ lat: p.lat, lon: p.lon });
    if (S.issTrail.length > 240) S.issTrail.shift();
    renderMapISS();
    if (useGlobe) { GODSEYE.state.iss = { lat: p.lat, lon: p.lon, alt: p.alt }; GODSEYE.state.issPath = S.issTrail.slice(-60); GODSEYE.renderISS(); }
  } catch (e) { $("#iss-hud").textContent = "ISS: LINK LOST"; }
}
async function refreshKp() {
  try { S.kp = await API.kp(); bumpLive(); } catch (e) { }
}
async function refreshCrypto() {
  try {
    S.crypto = await API.crypto();
    const box = $("#markets-mini");
    box.innerHTML = S.crypto.map(c => {
      const up = c.chg != null && c.chg >= 0;
      const nm = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL" }[c.id] || c.id.toUpperCase();
      return `<div>${nm} <b>$${Math.round(c.usd).toLocaleString("en-IN")}</b> <span class="${up ? "up" : "down"}">${c.chg == null ? "" : (up ? "+" : "") + c.chg.toFixed(1) + "%"}</span></div>`;
    }).join("");
    bumpLive();
  } catch (e) { }
}
async function refreshNews() {
  try { S.news.world = await API.worldNews(8); bumpLive(); } catch (e) { }
  try { S.news.tech = await API.techNews(6); bumpLive(); } catch (e) { }
}
async function refreshFlights() {
  await GODSEYE.fetchFlights(S.scanCenter.lat, S.scanCenter.lon);
  await GODSEYE.fetchMilFlights(S.scanCenter.lat, S.scanCenter.lon);
  syncGlobeData();
}
async function refreshSats() {
  const n = await GODSEYE.fetchTLEs();
  if (n) { GODSEYE.propagateSats(); syncGlobeData(); }
}
async function refreshAll() {
  liveFeeds = 0;
  await Promise.allSettled([refreshQuakes(), refreshISS(), refreshKp(), refreshCrypto(), refreshNews(), refreshFlights()]);
  updateCounts();
  log("sys", "[SYS]", `refresh ok · ${liveFeeds} feeds`);
}

/* ================= voice ================= */
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
    wctx.fillStyle = active ? (listening ? "rgba(255,77,94,.9)" : "rgba(53,224,255,.9)") : "rgba(84,104,124,.5)";
    wctx.fillRect(i * bw + 1, (H - h) / 2, bw - 2, h);
  }
}
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  const byLang = (l) => vs.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(l.toLowerCase()));
  const female = (arr) => arr.find((v) => /female|zira|heera|neerja|sonia|libby|swara|google|kalpana|madhuri/i.test(v.name));
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
  if (v) { u.voice = v; u.lang = v.lang; } // voice+lang consistent — prevents silent TTS
  u.onstart = () => { speaking = true; $("#comms-mode").textContent = "BOL RAHI HOON"; };
  u.onend = () => {
    speaking = false; $("#comms-mode").textContent = listening ? "SUN RAHI HOON" : "STANDBY";
    // VOICE LOOP FIX: reopen mic only AFTER ADA finishes speaking (old logic reopened
    // during speech, got skipped by the speaking-guard, and the loop died silently)
    if (voiceLoop && !listening && !convo.busy) {
      setTimeout(() => { if (voiceLoop && !listening && !speaking && !convo.busy) toggleVoice(); }, 600);
    }
  };
  u.onerror = (e) => {
    speaking = false; $("#comms-mode").textContent = "STANDBY";
    if (voiceLoop && !listening && !convo.busy) {
      setTimeout(() => { if (voiceLoop && !listening && !speaking && !convo.busy) toggleVoice(); }, 600);
    }
  };
  speechSynthesis.speak(u);
}
/* natural reply: strip asterisks/dashes/markdown so it reads like human speech */
function cleanForSpeech(t) {
  return String(t)
    .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold**
    .replace(/\*([^*]+)\*/g, "$1")       // *italic*
    .replace(/`([^`]+)`/g, "$1")        // `code`
    .replace(/^#{1,4}\s+/gm, "")         // headings
    .replace(/^\s*[-•]\s+/gm, "")        // list dashes
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // links
    .replace(/[_~|>#]+/g, " ")            // misc md chars
    .replace(/\s{2,}/g, " ")
    .trim();
}
function respond(text, sayIt = true) {
  const clean = cleanForSpeech(text);
  chatMsg(clean, "ada");
  if (sayIt) speak(clean);
}
function log(level, tag, text) { chatThinking && null; /* terminal removed; keep for compat */ }

/* ================= input wiring ================= */
async function sendChat() {
  const inp = $("#chat-in");
  const v = inp.value.trim();
  if (!v) return;
  inp.value = "";
  chatMsg(v, "user");
  const th = chatThinking();
  // bridge AI (primary) needs no sign-in; puter fallback opens popup on demand inside AI.chat
  try { await handleCommand(v); }
  catch (e) { chatMsg("arrey, kuch technical gadbad ho gayi — phir se try karo", "ada"); }
  th.remove();
}
$("#chat-send").addEventListener("click", sendChat);
$("#chat-in").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });

function toggleVoice() {
  if (!SR) { chatMsg("is browser me voice support nahi hai — Chrome/Edge try karo. Type karke poochho, main sun rahi hoon.", "ada"); return; }
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
    listening = false; $("#voice-btn").classList.remove("listening"); $("#voice-btn").textContent = "▸ BOLNA SHURU KARO (V)";
    if (!speaking) $("#comms-mode").textContent = "STANDBY";
    // NOTE: mic reopen now handled in speak().onend (after ADA finishes talking).
    // If no speech will happen (e.g. no-speech error), reopen here after a delay.
    if (voiceLoop && !speaking && !convo.busy) {
      setTimeout(() => { if (voiceLoop && !listening && !speaking && !convo.busy) toggleVoice(); }, 800);
    }
  };
  try { recog.start(); } catch (e) { }
}
$("#voice-btn").addEventListener("click", () => { voiceLoop = !voiceLoop; toggleVoice(); });
document.addEventListener("keydown", (e) => {
  if (e.target === $("#chat-in")) return;
  const k = e.key.toLowerCase();
  if (k === "v") { voiceLoop = !voiceLoop; toggleVoice(); }
  else if (k === "m") { ttsOn = !ttsOn; $("#tts-state").textContent = ttsOn ? "TTS ON" : "TTS OFF"; speechSynthesis.cancel(); }
  else if (k === "/") { e.preventDefault(); $("#chat-in").focus(); }
  else if (k === "l") { GODSEYE.flyTo(S.scanCenter.lat, S.scanCenter.lon, 1.2); }
});

/* ================= layer buttons ================= */
document.querySelectorAll("#ge-layer-btns .lbtn").forEach(b => {
  b.addEventListener("click", () => {
    const key = b.dataset.layer;
    const on = !b.classList.contains("on");
    b.classList.toggle("on", on);
    if (key === "quakes") { S.layerOn.quakes = on; if (useGlobe) GODSEYE.setLayer("quakes", on); renderMapQuakes(); }
    if (key === "flights" && useGlobe) GODSEYE.setLayer("flights", on);
    if (key === "sats" && useGlobe) GODSEYE.setLayer("sats", on);
    if (key === "iss") { S.layerOn.iss = on; if (useGlobe) GODSEYE.setLayer("iss", on); renderMapISS(); }
  });
});
$("#btn-locate").addEventListener("click", () => {
  GODSEYE.flyTo(S.scanCenter.lat, S.scanCenter.lon, 0.9);
  refreshFlights();
});
$("#btn-2d").addEventListener("click", () => {
  useGlobe = !useGlobe;
  $("#globe").style.display = useGlobe ? "block" : "none";
  $("#map").style.display = useGlobe ? "none" : "block";
  $("#hud-mode").textContent = useGlobe ? "3D GLOBE" : "2D MAP";
  if (!useGlobe && !map) initMap();
  if (useGlobe) syncGlobeData(); else { renderMapQuakes(); renderMapISS(); }
});

/* ================= zoom + rotate controls ================= */
let autoRotate = true, rotTimer = null;
function setAutoRotate(on) {
  autoRotate = on;
  $("#zoom-rot").style.borderColor = on ? "var(--cyan)" : "";
  $("#zoom-rot").style.color = on ? "var(--cyan)" : "";
  if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
  if (on && useGlobe && GODSEYE.ready()) {
    GODSEYE.setAutoRotateOK(true);
    rotTimer = setInterval(() => {
      try { GODSEYE.rotate(); } catch (e) { }
    }, 60);
  } else if (!on) {
    GODSEYE.setAutoRotateOK(false);
  }
}
$("#zoom-in").addEventListener("click", () => {
  if (useGlobe && GODSEYE.ready()) GODSEYE.zoom(-0.4);
  else if (map) map.zoomIn();
});
$("#zoom-out").addEventListener("click", () => {
  if (useGlobe && GODSEYE.ready()) GODSEYE.zoom(0.4);
  else if (map) map.zoomOut();
});
$("#zoom-rot").addEventListener("click", () => setAutoRotate(!autoRotate));

/* ================= quick chips ================= */
document.querySelectorAll("#chat-chips .qchip").forEach(c => {
  c.addEventListener("click", () => {
    $("#chat-in").value = c.textContent;
    sendChat();
  });
});

/* ================= boot ================= */
const BOOT = [
  ["ADA GOD'S EYE v2.0 — cold start", false],
  ["> spinning 3D globe engine .......... <b>OK</b>", true],
  ["> linking live flight radar (ADS-B) . <b>OK</b>", true],
  ["> loading Starlink constellation .... <b>OK</b>", true],
  ["> arming AI neural core ............ <b>OK</b>", true],
  ["<b>NO PLACE LEFT HIDDEN — WELCOME SAKET</b>", true],
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

/* ================= bridge status ================= */
async function pollBridge() {
  try {
    const r = await fetch("http://127.0.0.1:8742/status", { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
    const j = await r.json();
    if (j.error || !j.alive) throw new Error();
    $("#bridge-label").textContent = "OS: ARMED";
    $("#bridge-chip").querySelector(".led").style.background = "var(--green)";
    $("#bridge-chip").querySelector(".led").style.boxShadow = "0 0 6px var(--green)";
  } catch (e) {
    $("#bridge-label").textContent = "OS: OFFLINE";
    $("#bridge-chip").querySelector(".led").style.background = "var(--amber)";
    $("#bridge-chip").querySelector(".led").style.boxShadow = "0 0 6px var(--amber)";
  }
}

/* ================= main ================= */
function frame(now) { drawWave(now); requestAnimationFrame(frame); }
window.addEventListener("resize", sizeWave);
if ("speechSynthesis" in window) { speechSynthesis.onvoiceschanged = () => { }; speechSynthesis.getVoices(); }
const prime = () => { const u = new SpeechSynthesisUtterance(""); u.volume = 0; speechSynthesis.speak(u); document.removeEventListener("click", prime); document.removeEventListener("keydown", prime); };
document.addEventListener("click", prime);
document.addEventListener("keydown", prime);
window.addEventListener("error", (e) => { try { chatMsg("error: " + (e.message || e.type), "ada"); } catch (_) { } });

initMap();
initGlobe();
bindTogglesCompat();
sizeWave();
pollBridge();
setInterval(pollBridge, 30000);
runBoot(() => {
  refreshAll();
  refreshSats();
  GODSEYE.setAutoRotateOK(true);
  setAutoRotate(true);
  // stop auto-rotate when user touches the globe
  const gEl = $("#globe");
  if (gEl) ["mousedown", "wheel", "touchstart"].forEach(ev => gEl.addEventListener(ev, () => { GODSEYE.setAutoRotateOK(false); }, { once: true, passive: true }));
  setInterval(refreshAll, 120000);
  setInterval(refreshISS, 15000);
  setInterval(() => { if (useGlobe) { GODSEYE.propagateSats(); GODSEYE.renderSats(); updateCounts(); } }, 30000);
  setInterval(() => { GODSEYE.fetchFlights(S.scanCenter.lat, S.scanCenter.lon).then(syncGlobeData); }, 60000);
});
requestAnimationFrame(frame);

/* compat shim so brain.js/tools.js toggles keep working */
function bindTogglesCompat() {
  window.__adaMap = window.__adaMap || (map ? { map } : null);
}
