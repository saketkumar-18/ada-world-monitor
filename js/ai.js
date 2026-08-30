/* ADA — AI brain layer. MULTI-PROVIDER, zero signup.
 * 1) Pollinations (anonymous, needs referrer) — primary
 * 2) Puter.js (free account, richer models) — fallback
 * 3) Error message explains exactly what to do.
 */
"use strict";

const AI = (() => {

  const AVAL = {
    LM_MODELS: ["openai", "mistral"],
    LM_DEFAULT: "openai",
    LM_FALLBACK: "mistral",
  };

  /* ---------- provider 1: Pollinations (anonymous) ---------- */
  async function chatPollinations(messages, opts) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 45000);
    try {
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: c.signal,
        body: JSON.stringify({
          model: opts.model || AVAL.LM_DEFAULT,
          messages,
          referrer: "ada-gods-eye",
          max_tokens: 800,
        }),
      });
      if (!r.ok) throw new Error("pollinations HTTP " + r.status);
      const d = await r.json();
      const m = d.choices && d.choices[0] && d.choices[0].message;
      if (!m || !m.content) throw new Error("pollinations empty");
      return m.content;
    } finally { clearTimeout(t); }
  }

  /* ---------- provider 2: Puter.js (PRIMARY — permanent free AI) ---------- */
  function ready() {
    return typeof puter !== "undefined" && puter.ai && puter.ai.chat;
  }
  function signedIn() {
    try { return typeof puter !== "undefined" && puter.auth && typeof puter.auth.isSignedIn === "function" && puter.auth.isSignedIn(); }
    catch (e) { return false; }
  }
  /* MUST be called inside a user-gesture (click/Enter) — otherwise popup is blocked */
  async function ensureSignIn() {
    if (!ready()) throw new Error("puter not loaded");
    if (signedIn()) return true;
    if (puter.auth && typeof puter.auth.signIn === "function") {
      try { await puter.auth.signIn(); } catch (e) {
        throw new Error("sign-in popup blocked — browser ke address bar me popup-blocker icon allow karo, phir dobara bhejo");
      }
    }
    return signedIn();
  }
  async function chatPuter(messages, opts = {}) {
    if (!ready()) throw new Error("puter not loaded");
    const resp = await puter.ai.chat(messages, { model: opts.model || "openai/gpt-5.4-nano" });
    if (typeof resp === "string") return resp;
    if (resp && resp.message) {
      const c = resp.message.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : p.text || "")).join("");
    }
    if (resp && typeof resp.text === "string") return resp.text;
    throw new Error("puter unknown shape");
  }

  /* ---------- provider 0: ADA Bridge (localhost) — Saket's own GLM model via tokenrouter.
   * No signup, no popup, key stays on the laptop. PRIMARY. ---------- */
  async function chatBridge(messages, opts) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 100000);
    try {
      const r = await fetch("http://127.0.0.1:8742/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: c.signal,
        body: JSON.stringify({ messages, model: opts.model || "z-ai/glm-5.3-free" }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error("bridge: " + (d.error || r.status));
      if (!d.content) throw new Error("bridge empty content");
      return d.content;
    } finally { clearTimeout(t); }
  }

  function bridgeUp() {
    return fetch("http://127.0.0.1:8742/status", { signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined })
      .then(r => r.ok).catch(() => false);
  }

  /* ---------- unified chat: bridge (own model, no signup) → puter → pollinations ---------- */
  async function chat(messages, opts = {}) {
    let err1;
    try { return await chatBridge(messages, opts); }
    catch (e) { err1 = e; }
    let err2;
    try { return await chatPuter(messages, opts); }
    catch (e) { err2 = e; }
    let err3;
    try { return await chatPollinations(messages, opts); }
    catch (e) { err3 = e; }
    throw new Error("AI down (bridge: " + (err1.message || "").slice(0, 60) + " / puter: " + (err2.message || "").slice(0, 60) + " / pollinations: " + (err3.message || "").slice(0, 60) + ")");
  }

  function signedIn() {
    try { return typeof puter !== "undefined" && puter.auth && typeof puter.auth.isSignedIn === "function" && puter.auth.isSignedIn(); }
    catch (e) { return false; }
  }
  async function ensureSignIn() {
    // bridge AI needs no sign-in at all; this exists only for the puter fallback path
    if (bridgeUp) { /* bridge first — typically never reaches here */ }
    if (signedIn()) return true;
    if (typeof puter !== "undefined" && puter.auth && typeof puter.auth.signIn === "function") {
      try { await puter.auth.signIn(); } catch (e) { throw new Error("sign-in popup blocked — address bar me popup allow karo"); }
    }
    return signedIn();
  }

  /* ---------- knowledge tools ---------- */
  async function wiki(query, lang = "en") {
    const lg = (lang || "en").split("-")[0];
    const host = ["en", "hi", "es", "fr", "de", "pt", "ru", "ar", "zh", "ja", "ko", "it", "tr", "id", "bn", "ta", "te", "mr"].includes(lg) ? lg : "en";
    const surl = `https://${host}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
    const sr = await fetch(surl).then((r) => r.json());
    if (!sr.query || !sr.query.search || !sr.query.search.length) return null;
    const title = sr.query.search[0].title;
    const murl = `https://${host}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const m = await fetch(murl).then((r) => r.json());
    return { title, extract: m.extract, url: m.content_urls ? m.content_urls.desktop.page : null, lang: host };
  }

  async function fx(base = "USD", symbols = "INR,EUR,GBP,JPY") {
    const d = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols}`).then((r) => r.json());
    return { base: d.base, date: d.date, rates: d.rates };
  }

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
      L.push("kp_index:" + k.kp.toFixed(1));
    }
    if (S.crypto && S.crypto.length) {
      L.push("crypto:" + S.crypto.map((c) => `${c.id}=$${Math.round(c.usd)}(${c.chg != null ? c.chg.toFixed(1) + "%" : "na"})`).join(" "));
    }
    if (S.issNow) {
      L.push(`iss:lat ${S.issNow.lat.toFixed(1)},lon ${S.issNow.lon.toFixed(1)},alt ${Math.round(S.issNow.alt)}km,vel ${Math.round(S.issNow.vel)}km/h`);
    }
    if (S.climate && S.climate.temp != null) {
      L.push(`delhi_weather:temp ${S.climate.temp}C,wind ${Math.round(S.climate.wind)}km/h,rh ${S.climate.rh}%,aqi ${S.climate.aqi ?? "na"}`);
    }
    if (S.news && S.news.world && S.news.world.length) {
      L.push("top_headlines:" + S.news.world.slice(0, 5).map((n) => n.title).join(" | "));
    }
    if (S.launches && S.launches.length) {
      L.push(`next_launch:${S.launches[0].name} (${S.launches[0].status})`);
    }
    try {
      if (typeof GODSEYE !== "undefined" && GODSEYE.counts) {
        const c = GODSEYE.counts();
        if (c.flights) L.push(`live_flights:${c.flights} (military:${c.milFlights || 0}) near ${S.scanCenter ? S.scanCenter.name : "scan center"}`);
        if (c.sats) L.push(`starlink_tracked:${c.sats}/${c.totalSats}`);
      }
    } catch (e) { }
    return L.length ? L.join("\n") : "no_live_data_synced_yet";
  }

  return { ...AVAL, ready, signedIn, ensureSignIn, chat, wiki, fx, liveBlock, chatPollinations, chatPuter };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AI;
