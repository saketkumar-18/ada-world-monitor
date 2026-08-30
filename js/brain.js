/* ADA v2 — conversational brain bridge (app side).
 * Any-language voice → AI (Puter.js) with live-data context → spoken reply.
 * Fast local commands still bypass the LLM for instant answers.
 */
"use strict";

/* ================= conversational state ================= */
const convo = { history: [], lastLang: null, busy: false };

/* Language auto-detection from the transcript (script + common words) */
function detectLang(text) {
  const t = text.toLowerCase();
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";            // Devanagari
  if (/[\u3040-\u30FF]/.test(text)) return "ja-JP";            // Kana → Japanese (before Han)
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";            // Han → Chinese
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko-KR";            // Hangul
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";            // Arabic
  if (/[\u0400-\u04FF]/.test(text)) return "ru-RU";            // Cyrillic
  if (/[\u0E00-\u0E7F]/.test(text)) return "th-TH";
  if (/\b(kya|hai|kaise|kyun|aap|tum|mera|tera|batao|bata|karo|kahan|kab|kaun|kitna|acha|thik|nahi|haan)\b/.test(t)) return "hi-IN";
  if (/\b(what|who|when|where|why|how|tell|show|give|is|are|the|a)\b/.test(t)) return "en-IN";
  return "en-IN";
}

/* ---- intent: fast local commands (no LLM round-trip) ---- */
function localCommand(q) {
  const m = q.trim().toLowerCase().replace(/^(hey |ok |okay )?(ada|jarvis|friday)[, :]*/, "");
  if (!m) return null;

  if (/^(help|commands|madad|madho)/.test(m)) return () => respond("Commands: briefing, quakes, news, bitcoin, launches, weather <city>, iss, space weather, fx <pair>, country <name>, or ask me anything in any language — I am now a full AI. Bolo kuch bhi.");
  if (/brief|morning|situation|summary|brif|sanchay/.test(m)) return () => morningBriefing(true);

  if (/^(quakes?|seismic|earthquake|bhukamp)/.test(m)) {
    return () => {
      if (S.quakes.length) {
        const top = S.quakes.slice(0, 3);
        respond("Top seismic: " + top.map((t) => `M${t.mag}, ${t.place}, ${ago(t.time)}`).join(". ") + ".");
      } else respond("Seismic feed syncing.", false);
    };
  }
  if (/^(bitcoin|btc|crypto|market|ethereum|solana)/.test(m)) {
    return () => {
      const btc = S.crypto.find((c) => c.id === "bitcoin");
      const eth = S.crypto.find((c) => c.id === "ethereum");
      btc ? respond(`Bitcoin $${Math.round(btc.usd).toLocaleString("en-IN")}${btc.chg != null ? ", " + (btc.chg >= 0 ? "up" : "down") + " " + Math.abs(btc.chg).toFixed(1) + "%" : ""}. Ethereum $${eth ? Math.round(eth.usd).toLocaleString("en-IN") : "--"}.`) : respond("Market syncing.", false);
    };
  }
  if (/^(iss|station)/.test(m)) {
    return () => S.issNow ? respond(`ISS at ${S.issNow.lat.toFixed(1)}N ${Math.abs(S.issNow.lon).toFixed(1)}${S.issNow.lon >= 0 ? "E" : "W"}, altitude ${Math.round(S.issNow.alt)} km, speed ${Math.round(S.issNow.vel)} km/h.`) : respond("ISS syncing.", false);
  }
  if (/^(space weather|kp|solar|geomag|storm)/.test(m)) {
    return () => {
      const k = S.kp[S.kp.length - 1];
      k ? respond(`Geomagnetic Kp ${k.kp.toFixed(1)} — ${kpLabel(k.kp).toLowerCase()} conditions.`) : respond("Space weather syncing.", false);
    };
  }
  if (/^(news|headline)/.test(m)) {
    return () => S.news.world.length ? respond("Top stories: " + S.news.world.slice(0, 3).map((n) => n.title).join(". ") + ".") : respond("News syncing.", false);
  }
  if (/^(launch|rocket|spacex)/.test(m)) {
    return () => S.launches.length ? respond(`Next launch: ${S.launches[0].name} by ${S.launches[0].provider || "unknown"}, status ${S.launches[0].status}.`) : respond("Launch feed syncing.", false);
  }
  if (/^(mute|quiet|silence|chup)/.test(m)) return () => { ttsOn = false; $("#tts-state").textContent = "TTS OFF"; speechSynthesis.cancel(); log("sys", "[SYS]", "voice muted"); };
  if (/^(speak|unmute|voice on|bolo)/.test(m)) return () => { ttsOn = true; $("#tts-state").textContent = "TTS ON"; respond("Voice enabled."); };
  if (/^(refresh|update|sync|update karo)/.test(m)) return () => { respond("Refreshing feeds.", false); refreshAll(); };

  // weather <city> — real fetch, spoken in user's language
  const wm = m.match(/(?:weather|mausam|meteo|clima)\s+(?:in|me|of|at)?\s*([a-z\u00C0-\u024F\s]{2,30})$/);
  if (wm) {
    const city = wm[1].trim();
    return async () => {
      try {
        const g = await API.geo(city);
        if (!g) return respond(`Could not locate ${city}.`, false);
        const w = await API.weather(g.lat, g.lon);
        respond(`${g.name}: ${w.temp.toFixed(0)} degrees, ${WMO[w.code] || "current conditions"}, wind ${Math.round(w.wind)} km/h.`);
      } catch (e) { respond("Weather link failed.", false); }
    };
  }
  // fx <pair> — currency rates
  const fm = m.match(/^(?:fx|rate|exchange)\s+([a-z]{3})\s*(?:to|\/|vs)?\s*([a-z]{3})?$/);
  if (fm) {
    const base = fm[1].toUpperCase(), to = (fm[2] || "INR").toUpperCase();
    return async () => {
      try {
        const r = await AI.fx(base, to);
        respond(`1 ${base} = ${r.rates[to] != null ? r.rates[to].toFixed(2) + " " + to : "unavailable"}. ECB reference, ${r.date}.`);
      } catch (e) { respond("FX link failed.", false); }
    };
  }
  return null;
}

/* ---- the AI brain answer → now the AGENT loop ---- */
async function aiAnswer(userText, lang) {
  convo.busy = true;
  $("#comms-mode").textContent = "THINKING";
  log("info", "[AI]", "agent engaged · tools armed");
  try {
    if (!AI.ready()) throw new Error("AI core offline — js.puter.com not loaded");
    const out = await AGENT.run(userText, lang, {
      log,
      onStep: (n, tool) => { $("#comms-mode").textContent = "TOOL: " + tool.toUpperCase(); },
    });
    convo.history.push({ role: "user", content: userText }, { role: "assistant", content: out });
    if (convo.history.length > 12) convo.history = convo.history.slice(-12);
    respond(out, true);
    log("ok", "[AI]", "task complete (" + out.length + " chars)");
  } catch (e) {
    log("err", "[AI]", e.message);
    respond("AI core offline. Free AI needs a one-time Puter sign-in (popup on first AI question). Local commands, feeds and briefing still work.", false);
  } finally {
    convo.busy = false;
    $("#comms-mode").textContent = listening ? "LISTENING" : "STANDBY";
  }
}

/* ---- unified command router: local fast-path first, then AI ---- */
async function handleCommand(raw) {
  const text = raw.trim();
  if (!text) return;
  log("user", "[OP]", text);
  const lang = detectLang(text);
  convo.lastLang = lang;

  const fast = localCommand(text);
  if (fast) { const fn = fast(); if (fn && fn.then) await fn; return; }

  // anything else → the AI brain
  await aiAnswer(text, lang);
}
