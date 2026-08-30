/* ADA v3 — TOOL LAYER: 20+ executable tools.
 * The AI agent calls these by name; each returns data or performs an action.
 * All free / keyless. Browser-side.
 */
"use strict";

const TOOLS = (() => {

  const R = {}; // registry: name -> {desc, params, run}

  const j = async (u, ms = 12000) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      const r = await fetch(u, { signal: c.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  };
  const txt = async (u, ms = 15000) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(u, { signal: c.signal }); return await r.text(); }
    finally { clearTimeout(t); }
  };

  /* ---------- KNOWLEDGE / WEB ---------- */

  R.wiki = {
    desc: "Wikipedia knowledge lookup. Params: query (string), lang (optional 'en'|'hi'|...). Returns title+extract+url.",
    params: { query: "string", lang: "string?" },
    async run(a) {
      const lg = (a.lang || "en").slice(0, 2);
      const host = ["en","hi","es","fr","de","pt","ru","ar","zh","ja","ko","it","tr","id","bn","ta","te","mr"].includes(lg) ? lg : "en";
      const s = await j(`https://${host}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(a.query)}&srlimit=1&format=json&origin=*`);
      if (!s.query || !s.query.search || !s.query.search.length) return { error: "no article found" };
      const title = s.query.search[0].title;
      const m = await j(`https://${host}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      return { title, extract: m.extract, url: m.content_urls && m.content_urls.desktop.page };
    }
  };

  R.web_search = {
    desc: "Search the live web (DuckDuckGo). Params: query. Returns top 5 {title,url,snippet}. Use for anything current or obscure.",
    params: { query: "string" },
    async run(a) {
      const h = await txt("https://r.jina.ai/https://duckduckgo.com/html/?q=" + encodeURIComponent(a.query));
      const links = [...h.matchAll(/\[([^\]]{10,120})\]\((https?:\/\/duckduckgo\.com\/l\/\?uddg=([^))]+))\)/g)]
        .map((m) => ({ title: m[1], url: decodeURIComponent(m[3]) }))
        .filter((x) => /^https?:\/\//.test(x.url) && !x.url.includes("duckduckgo.com"));
      const seen = new Set();
      const uniq = links.filter((x) => !seen.has(x.url) && seen.add(x.url));
      return { results: uniq.slice(0, 5) };
    }
  };

  R.read_url = {
    desc: "Fetch and read any web page/article (clean text, first ~4000 chars). Params: url.",
    params: { url: "string" },
    async run(a) {
      if (!/^https?:\/\//.test(a.url)) return { error: "bad url" };
      const t = await txt("https://r.jina.ai/" + a.url, 20000);
      return { content: t.slice(0, 4000) };
    }
  };

  /* ---------- LIVE WORLD DATA ---------- */

  R.quakes = {
    desc: "Live earthquakes M2.5+ last 24h (USGS). Params: limit (number?, default 10). Sorted newest first.",
    params: { limit: "number?" },
    async run(a) {
      const d = await j("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
      const n = a.limit || 10;
      return { quakes: d.features.slice(0, n).map((f) => ({ mag: f.properties.mag, place: f.properties.place, time: new Date(f.properties.time).toISOString(), depth_km: f.geometry.coordinates[2], lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] })) };
    }
  };

  R.iss = {
    desc: "Live ISS position, altitude, velocity (wheretheiss.at). No params.",
    params: {},
    async run() {
      const d = await j("https://api.wheretheiss.at/v1/satellites/25544");
      return { lat: d.latitude, lon: d.longitude, alt_km: d.altitude, vel_kmh: d.velocity, visibility: d.visibility };
    }
  };

  R.weather = {
    desc: "Live weather for any city (Open-Meteo). Params: city. Returns temp, wind, humidity, conditions.",
    params: { city: "string" },
    async run(a) {
      const g = await j("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(a.city) + "&count=1");
      if (!g.results || !g.results.length) return { error: "city not found" };
      const r = g.results[0];
      const w = await j(`https://api.open-meteo.com/v1/forecast?latitude=${r.latitude}&longitude=${r.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`);
      const AQ = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow", 80: "rain showers", 95: "thunderstorm", 96: "thunderstorm+hail", 99: "severe thunderstorm" };
      return { city: r.name, country: r.country, temp_c: w.current.temperature_2m, humidity: w.current.relative_humidity_2m, wind_kmh: w.current.wind_speed_10m, conditions: AQ[w.current.weather_code] || "code " + w.current.weather_code };
    }
  };

  R.air_quality = {
    desc: "Live US AQI + PM2.5 for any city (Open-Meteo). Params: city.",
    params: { city: "string" },
    async run(a) {
      const g = await j("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(a.city) + "&count=1");
      if (!g.results || !g.results.length) return { error: "city not found" };
      const r = g.results[0];
      const d = await j(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${r.latitude}&longitude=${r.longitude}&current=us_aqi,pm2_5`);
      return { city: r.name, us_aqi: d.current.us_aqi, pm2_5: d.current.pm2_5 };
    }
  };

  R.fx = {
    desc: "Live FX rates (ECB via Frankfurter). Params: base (3-letter, default USD), symbols (comma list, default INR,EUR,GBP,JPY).",
    params: { base: "string?", symbols: "string?" },
    async run(a) {
      const d = await j(`https://api.frankfurter.dev/v1/latest?base=${(a.base || "USD").toUpperCase()}&symbols=${(a.symbols || "INR,EUR,GBP,JPY").toUpperCase()}`);
      return { base: d.base, date: d.date, rates: d.rates };
    }
  };

  R.crypto = {
    desc: "Live crypto prices BTC/ETH/SOL (CoinGecko). No params.",
    params: {},
    async run() {
      const d = await j("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,inr&include_24hr_change=true");
      const out = {};
      for (const [k, v] of Object.entries(d)) out[k] = { usd: v.usd, inr: v.inr, chg24h_pct: v.usd_24h_change };
      return out;
    }
  };

  R.space_weather = {
    desc: "Geomagnetic Kp index (NOAA SWPC) — solar storm status. No params.",
    params: {},
    async run() {
      const d = await j("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json");
      const rows = d.slice(1).map((r) => ({ t: Array.isArray(r) ? r[0] : r.time_tag, kp: parseFloat(Array.isArray(r) ? r[1] : r.Kp) })).filter((r) => !isNaN(r.kp));
      const last = rows[rows.length - 1];
      const lvl = last.kp >= 7 ? "SEVERE STORM" : last.kp >= 5 ? "GEOMAGNETIC STORM" : last.kp >= 4 ? "UNSETTLED" : "QUIET";
      return { kp_now: last.kp, level: lvl, trend: rows.slice(-8).map((r) => r.kp) };
    }
  };

  R.launches = {
    desc: "Upcoming rocket launches (Launch Library 2). Params: limit (number?, default 3).",
    params: { limit: "number?" },
    async run(a) {
      const d = await j("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=" + (a.limit || 3) + "&mode=list");
      return { launches: d.results.map((r) => ({ name: r.name, net: r.net, status: r.status && r.status.abbrev, provider: r.launch_service_provider && r.launch_service_provider.name, pad: r.pad && r.pad.location && r.pad.location.name })) };
    }
  };

  R.news = {
    desc: "Live news headlines. Params: topic ('world'|'tech'|'business'|'science', default world), limit (default 5).",
    params: { topic: "string?", limit: "number?" },
    async run(a) {
      const feeds = { world: "https://feeds.bbci.co.uk/news/world/rss.xml", tech: "https://feeds.bbci.co.uk/news/technology/rss.xml", business: "https://feeds.bbci.co.uk/news/business/rss.xml", science: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" };
      const d = await j("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feeds[a.topic] || feeds.world));
      if (d.status !== "ok") return { error: "feed down" };
      return { headlines: d.items.slice(0, a.limit || 5).map((i) => ({ title: i.title, link: i.link, pub: i.pubDate })) };
    }
  };

  /* ---------- MATH / CONVERT ---------- */

  R.calc = {
    desc: "Evaluate math expressions safely (add/sub/mul/div/pow/sqrt/log/trig). Params: expression (e.g. '(23*4.5)+sqrt(144)').",
    params: { expression: "string" },
    async run(a) {
      const e = String(a.expression || "").replace(/[^0-9+\-*/().,%^ a-zA-Z]/g, "");
      if (!/^[0-9+\-*/().,%^ a-zA-Z]*$/.test(e)) return { error: "invalid" };
      const v = Function("sqrt,log,sin,cos,tan,pi,e,pow,abs,round,floor,ceil", `"use strict";return (${e.replace(/\^/g, "**")})`)(
        Math.sqrt, Math.log, Math.sin, Math.cos, Math.tan, Math.PI, Math.E, Math.pow, Math.abs, Math.round, Math.floor, Math.ceil);
      return { expression: a.expression, result: typeof v === "number" ? v : String(v) };
    }
  };

  R.convert = {
    desc: "Unit conversion: length, mass, temperature, volume, speed, data. Params: value, from, to (e.g. 5, km, miles).",
    params: { value: "number", from: "string", to: "string" },
    async run(a) {
      const U = {
        m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, mile: 1609.344, miles: 1609.344, ft: 0.3048, foot: 0.3048, feet: 0.3048, inch: 0.0254, in: 0.0254, yd: 0.9144, nmi: 1852,
        kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, pound: 0.45359237, pounds: 0.45359237, oz: 0.0283495, ton: 1000, tonne: 1000, stone: 6.35029,
        l: 1, liter: 1, litre: 1, ml: 0.001, gal: 3.78541, gallon: 3.78541, cup: 0.24, floz: 0.0295735,
        kmh: 1, kmph: 1, mph: 1.609344, ms: 3.6, knot: 1.852, knots: 1.852,
        kb: 1, mb: 1024, gb: 1048576, tb: 1073741824,
      };
      const f = String(a.from).toLowerCase(), t = String(a.to).toLowerCase(), v = Number(a.value);
      // temperature special
      const tempTo = { c: (x) => x, f: (x) => (x - 32) * 5 / 9, k: (x) => x - 273.15, celsius: (x) => x, fahrenheit: (x) => (x - 32) * 5 / 9, kelvin: (x) => x - 273.15 };
      const tempFrom = { c: (x) => x, f: (x) => x * 9 / 5 + 32, k: (x) => x + 273.15, celsius: (x) => x, fahrenheit: (x) => x * 9 / 5 + 32, kelvin: (x) => x + 273.15 };
      if (f in tempTo && t in tempFrom) return { value: v, from: f, to: t, result: +(tempFrom[t](tempTo[f](v))).toFixed(3) };
      if (f in U && t in U) return { value: v, from: f, to: t, result: +(v * U[f] / U[t]).toFixed(6) };
      return { error: "unknown units" };
    }
  };

  /* ---------- PERSONAL (localStorage) ---------- */

  R.remember = {
    desc: "Save a permanent note/fact about the operator (persists in this browser). Params: text.",
    params: { text: "string" },
    async run(a) {
      const notes = JSON.parse(localStorage.getItem("ada_notes") || "[]");
      notes.push({ t: a.text, at: Date.now() });
      localStorage.setItem("ada_notes", JSON.stringify(notes));
      return { saved: true, total_notes: notes.length };
    }
  };

  R.recall = {
    desc: "Recall saved notes/facts. No params (returns all).",
    params: {},
    async run() {
      return { notes: JSON.parse(localStorage.getItem("ada_notes") || "[]").map((n) => ({ note: n.t, when: new Date(n.at).toISOString() })) };
    }
  };

  R.todo = {
    desc: "Task list manager. Params: action ('add'|'list'|'done'|'clear'), text (for add), index (number for done).",
    params: { action: "string", text: "string?", index: "number?" },
    async run(a) {
      let todos = JSON.parse(localStorage.getItem("ada_todos") || "[]");
      if (a.action === "add") { todos.push({ t: a.text, done: false }); log("ok", "[TODO]", "added: " + a.text); }
      else if (a.action === "done") { if (todos[a.index]) todos[a.index].done = true; }
      else if (a.action === "clear") { todos = todos.filter((x) => !x.done); }
      localStorage.setItem("ada_todos", JSON.stringify(todos));
      return { todos };
    }
  };

  R.alarm = {
    desc: "Set a reminder for later. Params: in_minutes (number), message (string). Fires a spoken alert + on-screen toast.",
    params: { in_minutes: "number", message: "string" },
    async run(a) {
      const ms = (a.in_minutes || 1) * 60000;
      setTimeout(() => {
        respond("Reminder: " + a.message);
        try { log("ok", "[ALARM]", a.message); } catch (_) { }
        try { refreshAll(); } catch (_) { }
      }, ms);
      return { set: true, fires_in_minutes: a.in_minutes, message: a.message };
    }
  };

  /* ---------- DASHBOARD CONTROL (JARVIS actions) ---------- */

  R.map_go = {
    desc: "Move/zoom the ops map to a place. Params: place (e.g. 'Tokyo'), zoom (number?, 1-8, default 5).",
    params: { place: "string", zoom: "number?" },
    async run(a) {
      const g = await j("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(a.place) + "&count=1");
      if (!g.results || !g.results.length) return { error: "place not found" };
      const r = g.results[0];
      if (window.__adaMap && window.__adaMap.map) {
        window.__adaMap.map.flyTo([r.latitude, r.longitude], a.zoom || 5, { duration: 1.5 });
        return { moved: true, place: r.name + ", " + (r.country || "") };
      }
      return { error: "map offline" };
    }
  };

  R.map_layer = {
    desc: "Toggle map layers. Params: layer ('quakes'|'iss'|'chokepoints'), on (boolean).",
    params: { layer: "string", on: "boolean" },
    async run(a) {
      const key = { quakes: "quakes", iss: "iss", chokepoints: "choke", choke: "choke" }[String(a.layer).toLowerCase()];
      if (!key) return { error: "unknown layer" };
      if (window.__adaLayers) return window.__adaLayers(key, !!a.on);
      return { error: "map offline" };
    }
  };

  R.open_url = {
    desc: "Open a website in a new browser tab for the operator. Params: url.",
    params: { url: "string" },
    async run(a) {
      const u = /^https?:\/\//.test(a.url) ? a.url : "https://" + a.url;
      window.open(u, "_blank", "noopener");
      return { opened: u };
    }
  };

  R.briefing = {
    desc: "Compile + speak the full situation briefing (all live feeds). No params.",
    params: {},
    async run() {
      const t = await morningBriefing(true);
      return { spoken: true, text: t };
    }
  };

  R.refresh_feeds = {
    desc: "Force-refresh ALL live data feeds now. No params.",
    params: {},
    async run() { refreshAll(); return { refreshing: true }; }
  };

  R.time_now = {
    desc: "Current date/time in any timezone. Params: tz (IANA, e.g. 'Asia/Kolkata', default local).",
    params: { tz: "string?" },
    async run(a) {
      try { return { time: new Date().toLocaleString("en-IN", a.tz ? { timeZone: a.tz } : {}), iso: new Date().toISOString() }; }
      catch (e) { return { error: "bad tz" }; }
    }
  };

  /* ---------- OS RUNTIME (ADA Local Bridge, localhost:8742) ---------- */

  const BRIDGE = "http://127.0.0.1:8742";
  async function bridge(route, body) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    try {
      const r = await fetch(BRIDGE + route, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: c.signal,
      });
      return await r.json();
    } catch (e) {
      return { error: "bridge_offline", hint: "start_ada_bridge.bat on the laptop" };
    } finally { clearTimeout(t); }
  }

  R.os_status = {
    desc: "Check if the OS runtime (ADA Local Bridge on the operator's laptop) is connected. No params. Call this first before os_run/queue_task.",
    params: {},
    async run() {
      const r = await bridge("/status");
      if (r.error) return { ...r, advice: "Tell the operator: run start_ada_bridge.bat in %LOCALAPPDATA%\\hermes\\scripts to give me OS-level hands." };
      return { bridge: "connected", uptime_s: r.uptime_s, queue: r.queue };
    }
  };

  R.os_run = {
    desc: "INSTANT OS actions on the operator's laptop (via bridge). Params: action ('open_url'|'open_app'|'notify'|'lock'|'shutdown'|'cancel_shutdown'|'sys_info'), args (object: url/app/message/i_am_sure).",
    params: { action: "string", args: "object?" },
    async run(a) {
      const r = await bridge("/run", { action: a.action, args: a.args || {} });
      log("info", "[OS]", a.action + " → " + JSON.stringify(r).slice(0, 100));
      return r;
    }
  };

  R.queue_task = {
    desc: "Queue a task for Saket Agent (autonomous Hermes worker, 24/7). It executes within ~15 min with FULL capabilities (files, code, deploys, research) and reports to Telegram. Use for any job too big to finish here. Params: task (string, self-contained instructions).",
    params: { task: "string" },
    async run(a) {
      const t = String(a.task || "").trim();
      if (t.length < 3) return { error: "task too short" };
      const r = await bridge("/queue", { task: t });
      if (!r.error) log("ok", "[QUEUE]", "task " + (r.id || "") + " dispatched to Saket Agent");
      return r;
    }
  };

  /* ---------- registry helpers ---------- */
  function names() { return Object.keys(R); }
  function schemas() {
    return Object.entries(R).map(([name, t]) => ({
      type: "function",
      function: {
        name,
        description: t.desc,
        parameters: {
          type: "object",
          properties: (() => {
            const o = {};
            for (const [k, v] of Object.entries(t.params || {})) {
              const opt = v.endsWith("?");
              o[k] = { type: opt ? v.slice(0, -1) : v };
            }
            return o;
          })(),
          required: Object.entries(t.params || {}).filter(([, v]) => !v.endsWith("?")).map(([k]) => k),
        },
      },
    }));
  }
  async function call(name, args) {
    if (!R[name]) return { error: "unknown tool " + name };
    try { return await R[name].run(args || {}); }
    catch (e) { return { error: name + ": " + e.message }; }
  }
  // text manifest (for models without native tool-calls)
  function manifest() { return Object.entries(R).map(([n, t]) => `- ${n}(${Object.keys(t.params || {}).join(", ")}): ${t.desc}`).join("\n"); }

  return { names, schemas, call, manifest, R };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TOOLS;
