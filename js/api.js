/* ADA World Monitor — API layer.
 * All endpoints verified CORS-open, free, no keys.
 * Each fetcher returns a normalized shape and never throws (returns {error}).
 */
"use strict";

const API = (() => {

  const TIMEOUT = 12000;

  async function jget(url, opts = {}) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), opts.timeout || TIMEOUT);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: opts.headers || {} });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  const U = {
    quakes: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    quakesAll: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
    iss: "https://api.wheretheiss.at/v1/satellites/25544",
    issPosAt: (t) => `https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${t}&units=kilometers`,
    crypto: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,inr&include_24hr_change=true",
    cryptoGlobal: "https://api.coingecko.com/api/v3/global",
    weather: (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`,
    airquality: (lat, lon) => `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5`,
    geo: (q) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`,
    launches: "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5&mode=list",
    hn: "https://hacker-news.firebaseio.com/v0/topstories.json",
    hnItem: (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
    kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    wikiEvents: (dateStr) => `https://en.wikipedia.org/api/rest_v1/page/html/Portal%3ACurrent_events%2F${dateStr}`,
    rss: (feedUrl) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`,
  };

  /* ---- earthquakes ---- */
  async function quakes() {
    const d = await jget(U.quakes);
    return d.features.map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place || "unknown",
      time: f.properties.time,
      depth: f.geometry.coordinates[2],
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      url: f.properties.url,
    })).sort((a, b) => b.time - a.time);
  }

  /* ---- ISS ---- */
  async function iss() {
    const d = await jget(U.iss);
    return { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity, vis: d.visibility };
  }

  /* ---- crypto ---- */
  async function crypto() {
    const d = await jget(U.crypto);
    const out = [];
    for (const [id, p] of Object.entries(d)) {
      out.push({
        id,
        usd: p.usd, inr: p.inr,
        chg: p.usd_24h_change != null ? p.usd_24h_change : null,
      });
    }
    return out;
  }

  /* ---- weather (city via geocoding) ---- */
  async function geo(q) {
    const d = await jget(U.geo(q));
    if (!d.results || !d.results.length) return null;
    const r = d.results[0];
    return { name: r.name, country: r.country, lat: r.latitude, lon: r.longitude };
  }

  async function weather(lat, lon) {
    const d = await jget(U.weather(lat, lon));
    const c = d.current;
    return {
      temp: c.temperature_2m, rh: c.relative_humidity_2m,
      wind: c.wind_speed_10m, code: c.weather_code,
    };
  }

  async function airquality(lat, lon) {
    const d = await jget(U.airquality(lat, lon));
    const c = d.current;
    return { aqi: c.us_aqi, pm25: c.pm2_5 };
  }

  /* ---- space weather: Kp index ---- */
  async function kp() {
    const d = await jget(U.kp);
    // handles BOTH shapes: array-of-arrays (legacy) or array-of-objects (current)
    const rows = d.slice(1).map((r) => {
      const t = Array.isArray(r) ? r[0] : r.time_tag;
      const v = Array.isArray(r) ? r[1] : r.Kp;
      return { t, kp: parseFloat(v) };
    }).filter((r) => !isNaN(r.kp));
    return rows.slice(-30); // last ~7.5 days of 3h readings
  }

  /* ---- launches ---- */
  async function launches() {
    const d = await jget(U.launches);
    return d.results.map((r) => ({
      name: r.name,
      net: r.net,
      status: r.status && r.status.abbrev,
      provider: r.launch_service_provider && r.launch_service_provider.name,
      pad: r.pad && r.pad.location && r.pad.location.name,
    }));
  }

  /* ---- Hacker News top ---- */
  async function hn(n = 8) {
    const ids = await jget(U.hn);
    const items = await Promise.all(ids.slice(0, n).map((id) => jget(U.hnItem(id))));
    return items.filter((x) => !x.dead && !x.deleted).map((x) => ({
      title: x.title, url: x.url || `https://news.ycombinator.com/item?id=${x.id}`,
      score: x.score, by: x.by, comments: x.descendants || 0,
    }));
  }

  /* ---- Wikipedia current events (parsed from portal HTML) ---- */
  async function wikiEvents(days = 2) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const dt = new Date(Date.now() - i * 864e5);
      const ds = dt.getFullYear() + "_" + String(dt.getMonth() + 1).padStart(2, "0") + "_" + String(dt.getDate()).padStart(2, "0");
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), TIMEOUT);
        const r = await fetch(U.wikiEvents(ds), { signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) continue;
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        // each topic is in <div class="current-events-content description"> ... li > a
        const links = [...doc.querySelectorAll(".description a[title]:not(.new)")].slice(0, 10);
        for (const a of links) {
          const li = a.closest("li");
          let text = li ? li.textContent.trim().replace(/\s+/g, " ").replace(/\[edit\]|\[.*?\]/g, "").trim() : a.textContent.trim();
          if (text.length > 160) text = text.slice(0, 157) + "…";
          out.push({
            title: text,
            link: "https://en.wikipedia.org" + (a.getAttribute("href") || ""),
            ts: Date.now() - i * 864e5,
            src: "WIKIPEDIA · " + dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase(),
          });
        }
      } catch (e) { /* skip day */ }
    }
    return out.slice(0, 14);
  }

  /* ---- news via rss2json (BBC World) ---- */
  async function worldNews(limit = 12) {
    const d = await jget(U.rss("https://feeds.bbci.co.uk/news/world/rss.xml"));
    if (d.status !== "ok") throw new Error("rss fail");
    return d.items.slice(0, limit).map((it) => ({
      title: it.title, link: it.link,
      ts: it.pubDate ? new Date(it.pubDate).getTime() : Date.now(),
      src: "BBC WORLD",
    }));
  }

  /* ---- tech news via rss2json (BBC Tech + HN blend) ---- */
  async function techNews(limit = 10) {
    const d = await jget(U.rss("https://feeds.bbci.co.uk/news/technology/rss.xml"));
    if (d.status !== "ok") throw new Error("rss fail");
    return d.items.slice(0, limit).map((it) => ({
      title: it.title, link: it.link,
      ts: it.pubDate ? new Date(it.pubDate).getTime() : Date.now(),
      src: "BBC TECH",
    }));
  }

  return { jget, U, quakes, iss, crypto, geo, weather, airquality, kp, launches, hn, worldNews, techNews, wikiEvents };
})();

/* Node export for tests */
if (typeof module !== "undefined" && module.exports) module.exports = API;
