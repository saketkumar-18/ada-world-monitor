/* ADA v2 — AI brain layer.
 * LLM: Puter.js (free, no API keys, hundreds of models).
 * Knowledge tools: Wikipedia (all languages), Frankfurter FX, USGS,
 * Open-Meteo, restcountries-free fallback, geo, launches, Kp, crypto, news.
 * Language: auto-detect — answers in the language the user speaks.
 */
"use strict";

const AI = (() => {

  const AVAL = {
    LM_MODELS: [
      "openai/gpt-5.4-nano",
      "anthropic/claude-sonnet-5",
      "google/gemini-3.1-pro-preview",
    ],
    LM_DEFAULT: "openai/gpt-5.4-nano",
    LM_FALLBACK: "anthropic/claude-sonnet-5",
  };

  function ready() {
    return typeof puter !== "undefined" && puter.ai && puter.ai.chat;
  }

  /* ---- raw chat ---- */
  async function chat(messages, opts = {}) {
    if (!ready()) throw new Error("AI core not loaded (js.puter.com)");
    const model = opts.model || AVAL.LM_DEFAULT;
    const resp = await puter.ai.chat(messages, { model });
    // response may be string, or {message:{content:[{text}]}} or {message:{content:".."}}
    if (typeof resp === "string") return resp;
    if (resp && resp.message) {
      const c = resp.message.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : p.text || "")).join("");
    }
    if (resp && typeof resp.text === "string") return resp.text;
    throw new Error("AI returned unknown shape");
  }

  /* ---- system prompt: ADA persona ---- */
  function sysPrompt(langHint) {
    return `You are ADA (Autonomous Digital Assistant), the AI inside the ADA World Monitor command center, serving operator Saket.
Rules:
- Detect the user's language automatically and ALWAYS reply in that same language (Hindi → Hindi, English → English, etc). If the user mixes languages, reply in the dominant one.
- You have LIVE TOOLS: the system message before each user turn includes a block like [LIVE DATA] key: value lines. Use them for any question about current quakes, ISS, Kp, crypto, weather, AQI, FX, news, launches, HN. Cite the numbers exactly.
- For general knowledge questions (history, science, math, code), answer accurately and concisely from your own knowledge.
- If live data for a topic is missing, say so briefly, then answer with general knowledge.
- Style: mission-control operator tone, concise, no fluff, no emoji. 1-4 sentences unless asked for more.
${langHint ? "- The operator's speech locale is " + langHint + " — likely reply language: " + langHint.split("-")[0] + "." : ""}`;
  }

  /* ---- knowledge tools (all free, CORS-open) ---- */

  // Wikipedia: search + summary in user's language wiki
  async function wiki(query, lang = "en") {
    const lg = (lang || "en").split("-")[0];
    const host = ["en", "hi", "es", "fr", "de", "pt", "ru", "ar", "zh", "ja", "ko", "it", "tr", "id", "bn", "ta", "te", "mr", "gu"].includes(lg) ? lg : "en";
    const surl = `https://${host}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
    const sr = await fetch(surl).then((r) => r.json());
    if (!sr.query || !sr.query.search || !sr.query.search.length) return null;
    const title = sr.query.search[0].title;
    const murl = `https://${host}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const m = await fetch(murl).then((r) => r.json());
    return { title, extract: m.extract, url: m.content_urls ? m.content_urls.desktop.page : "https://" + host + ".wikipedia.org/wiki/" + encodeURIComponent(title), lang: host };
  }

  // Frankfurter FX: latest + time series
  async function fx(base = "USD", symbols = "INR,EUR,GBP,JPY,CNY") {
    const d = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols}`).then((r) => r.json());
    return { base: d.base, date: d.date, rates: d.rates };
  }

  async function fxHistory(base, symbol, days = 30) {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const d = await fetch(`https://api.frankfurter.dev/v1/${start}..${end}?base=${base}&symbols=${symbol}`).then((r) => r.json());
    return Object.entries(d.rates || {}).map(([date, r]) => ({ date, v: r[symbol] }));
  }

  // Country info via Wikipedia fallback (restcountries is deprecated but alpha still works sometimes)
  async function country(name) {
    try {
      const d = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(name)}?fields=name,capital,population,region,subregion,languages,currencies,flag`).then((r) => r.json());
      if (Array.isArray(d) && d.length) return d[0];
      return null;
    } catch (e) { return null; }
  }

  // all feeds snapshot for the LLM context block
  function liveBlock(S) {
    const L = [];
    if (S.quakes && S.quakes.length) {
      L.push("quakes_24h_total:" + S.quakes.length);
      const m5 = S.quakes.filter((q) => q.mag >= 5);
      L.push("quakes_m5:" + m5.length);
      const top3 = S.quakes.slice(0, 3).map((q) => `M${q.mag} ${q.place} (${q.depth}km, ${Math.max(1, Math.round((Date.now() - q.time) / 60000))}m ago)`);
      L.push("quakes_top3:" + (top3.join(" | ") || "none"));
    }
    if (S.kp && S.kp.length) {
      const k = S.kp[S.kp.length - 1];
      L.push("kp_index:" + k.kp.toFixed(1), "kp_time:" + k.t);
    }
    if (S.crypto && S.crypto.length) {
      L.push("crypto:" + S.crypto.map((c) => `${c.id}=$${Math.round(c.usd)}(${c.chg != null ? c.chg.toFixed(1) + "%" : "na"})`).join(" "));
    }
    if (S.issNow) {
      L.push(`iss:lat ${S.issNow.lat.toFixed(1)},lon ${S.issNow.lon.toFixed(1)},alt ${Math.round(S.issNow.alt)}km,vel ${Math.round(S.issNow.vel)}km/h,${S.issNow.vis}`);
    }
    if (S.climate && S.climate.temp != null) {
      L.push(`delhi_weather:temp ${S.climate.temp}C,wind ${Math.round(S.climate.wind)}km/h,rh ${S.climate.rh}%,aqi ${S.climate.aqi ?? "na"},pm25 ${S.climate.pm25 ?? "na"},sky_code ${S.climate.code ?? "na"}`);
    }
    if (S.news && S.news.world && S.news.world.length) {
      L.push("top_headlines:" + S.news.world.slice(0, 5).map((n) => n.title).join(" | "));
    }
    if (S.launches && S.launches.length) {
      const l = S.launches[0];
      L.push(`next_launch:${l.name} (${l.status})`);
    }
    return L.length ? L.join("\n") : "no_live_data_synced_yet";
  }

  return { ...AVAL, ready, chat, sysPrompt, wiki, fx, fxHistory, country, liveBlock };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AI;
