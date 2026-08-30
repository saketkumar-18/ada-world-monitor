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

/* ---- natural briefing ---- */
async function morningBriefing(voice = true) {
  const parts = [];
  if (S.quakes.length) {
    const m5 = S.quakes.filter((q) => q.mag >= 5);
    parts.push(`zalzala ka scene: pichle 24 ghante me ${S.quakes.length} bhukamp aaye${m5.length ? `, jisme ${m5.length} bade the — sabse tez M${m5[0].mag}, ${m5[0].place}` : ""}`);
  }
  if (S.kp.length) {
    const last = S.kp[S.kp.length - 1];
    parts.push(`space weather Kp ${last.kp.toFixed(1)} pe hai, ${kpLabel(last.kp).toLowerCase()} level`);
  }
  if (S.crypto.length) {
    const btc = S.crypto.find((c) => c.id === "bitcoin");
    if (btc) parts.push(`Bitcoin $${Math.round(btc.usd).toLocaleString("en-IN")} pe hai${btc.chg != null ? ", " + (btc.chg >= 0 ? "upar" : "neeche") + " " + Math.abs(btc.chg).toFixed(1) + " percent" : ""}`);
  }
  if (S.issNow) parts.push(`ISS ${Math.round(S.issNow.alt)} km upar ${Math.round(S.issNow.vel)} km/h se ud rahi hai`);
  try {
    const c = GODSEYE.counts();
    if (c.flights) parts.push(`${c.flights} flights radar pe hain${c.milFlights ? " jisme " + c.milFlights + " military" : ""}`);
    if (c.sats) parts.push(`${c.sats} Starlink satellites track ho rahe hain`);
  } catch (e) { }
  if (S.climate && S.climate.temp != null) parts.push(`Delhi me ${S.climate.temp.toFixed(0)} degree hai${S.climate.aqi != null ? ", AQI " + S.climate.aqi : ""}`);
  if (S.news.world.length) parts.push(`top khabar: ${S.news.world[0].title}`);
  if (S.launches.length) parts.push(`agli rocket: ${S.launches[0].name}`);
  const text = "Saket, aaj ka scene suno. " + (parts.length ? parts.join(". ") + "." : "sab feeds load ho rahe hain.");
  respond(text);
  return text;
}

/* ---- intent: fast local commands (no LLM round-trip) ---- */
function localCommand(q) {
  const m = q.trim().toLowerCase().replace(/^(hey |ok |okay )?(ada|jarvis|friday)[, :]*/, "");
  if (!m) return null;

  if (/^(help|commands|madad|kya kar sakti ho|what can you do)/.test(m)) return () => respond("Main sab kuch kar sakti hoon! Poochho kuch bhi — news, weather, flights, satellites, bitcoin, math, history, science. Bolo 'Tokyo dikhao' to globe le jaungi. 'Chrome kholo' to khol dungi. Bada kaam ho to mera agent 15 minute me karke Telegram pe bata dega. Bas bol do jaise dost se baat karte ho!");
  if (/brief|morning|situation|summary|brif|sanchay|halaat/.test(m)) return () => morningBriefing(true);

  if (/^(quakes?|seismic|earthquake|bhukamp|zalzala)/.test(m)) {
    return () => {
      if (S.quakes.length) {
        const top = S.quakes.slice(0, 3);
        respond(`Pichle 24 ghante me ${S.quakes.length} earthquake aaye hain. Sabse tez: ` + top.map((t) => `M${t.mag} ${t.place} (${ago(t.time)})`).join(". ") + ". Globe pe orange rings dekh sakte ho.");
      } else respond("Zalzala data abhi load ho raha hai, ek minute.");
    };
  }
  if (/^(bitcoin|btc|crypto|market|ethereum|solana|paisa|paise)/.test(m)) {
    return () => {
      const btc = S.crypto.find((c) => c.id === "bitcoin");
      const eth = S.crypto.find((c) => c.id === "ethereum");
      btc ? respond(`Bitcoin abhi $${Math.round(btc.usd).toLocaleString("en-IN")} pe hai${btc.chg != null ? ", pichle din se " + (btc.chg >= 0 ? "+" : "") + btc.chg.toFixed(1) + "%" : ""}. Ethereum $${eth ? Math.round(eth.usd).toLocaleString("en-IN") : "--"} pe.`) : respond("Market data aa raha hai, second do.");
    };
  }
  if (/^(iss|station|space station)/.test(m)) {
    return () => S.issNow ? respond(`ISS abhi ${S.issNow.lat.toFixed(1)} degree north aur ${Math.abs(S.issNow.lon).toFixed(1)} degree ${S.issNow.lon >= 0 ? "east" : "west"} ke upar hai, ${Math.round(S.issNow.alt)} km ki height pe, ${Math.round(S.issNow.vel)} km/h ki raftaar se ud rahi hai. Globe pe cyan dot hai uski.`) : respond("ISS data sync ho raha hai.");
  }
  if (/^(space weather|kp|solar|geomag|storm|suraj)/.test(m)) {
    return () => {
      const k = S.kp[S.kp.length - 1];
      k ? respond(`Solar activity Kp ${k.kp.toFixed(1)} pe hai — ${kpLabel(k.kp).toLowerCase()} level ki activity hai.`) : respond("Space weather load ho rahi hai.");
    };
  }
  if (/^(news|headline|khabar|kya chal raha)/.test(m)) {
    return () => S.news.world.length ? respond("Top khabrein: " + S.news.world.slice(0, 3).map((n) => n.title).join(". ") + ".") : respond("News aa rahi hai, ek second.");
  }
  if (/^(launch|rocket|spacex|rocket launch)/.test(m)) {
    return () => S.launches.length ? respond(`Aglan launch: ${S.launches[0].name}, ${S.launches[0].provider || "kisi bhi provider"} ki taraf se. Status ${S.launches[0].status} hai.`) : respond("Launch data aa raha hai.");
  }
  if (/^(mute|quiet|silence|chup ho jao|chup)/.test(m)) return () => { ttsOn = false; $("#tts-state").textContent = "TTS OFF"; speechSynthesis.cancel(); chatMsg("Theek hai, ab main sirf type karungi.", "ada"); };
  if (/^(speak|bolo|unmute|voice on|awaz)/.test(m)) return () => { ttsOn = true; $("#tts-state").textContent = "TTS ON"; respond("Haan bolo, main ab bol kar bataungi!"); };
  if (/^(refresh|update|sync|update karo|refresh karo)/.test(m)) return () => { respond("Sab feeds refresh kar rahi hoon.", false); refreshAll(); };

  // weather <city>
  const wm = m.match(/(?:weather|mausam|meteo|clima|hawa)\s+(?:in|me|of|at|ka|ki|mein)?\s*([a-z\u00C0-\u024F\s]{2,30})$/);
  if (wm) {
    const city = wm[1].trim();
    return async () => {
      try {
        const g = await API.geo(city);
        if (!g) return respond(`${city} nahi mila mujhe — spelling check karo?`, false);
        const w = await API.weather(g.lat, g.lon);
        respond(`${g.name} me abhi ${w.temp.toFixed(0)} degree hai, ${WMO[w.code] || "normal"} weather, hawa ${Math.round(w.wind)} km/h chal rahi hai.`);
      } catch (e) { respond("Weather data nahi aa paya, thodi der baad try karo.", false); }
    };
  }
  // fx
  const fm = m.match(/^(?:fx|rate|exchange|dollar|dollar ka rate|rupaye)\s+([a-z]{3})\s*(?:to|\/|vs|me|in)?\s*([a-z]{3})?$/);
  if (fm) {
    const base = fm[1].toUpperCase(), to = (fm[2] || "INR").toUpperCase();
    return async () => {
      try {
        const r = await AI.fx(base, to);
        respond(`1 ${base} = ${r.rates[to] != null ? r.rates[to].toFixed(2) + " " + to : "pata nahi"}. ECB ka aaj ka rate hai.`);
      } catch (e) { respond("FX data nahi aaya.", false); }
    };
  }
  // "dikhao <place>" — fly the globe
  const sm = m.match(/^(?:dikhao|show|le chalo|fly to|jao|go to)\s+(.+)$/);
  if (sm) {
    const place = sm[1].trim();
    return async () => {
      try {
        const g = await API.geo(place);
        if (!g) return respond(`${place} nahi mila — naam dobara bolo?`, false);
        GODSEYE.flyTo(g.lat, g.lon, 1.5);
        S.scanCenter = { lat: g.lat, lon: g.lon, name: g.name.toUpperCase() };
        $("#loc-label").textContent = `${g.lat.toFixed(1)}N ${g.lon.toFixed(1)}E · ${S.scanCenter.name}`;
        refreshFlights();
        respond(`Le, ${g.name} pe pahunch gayi! Flights bhi wahan ka load kar rahi hoon.`);
      } catch (e) { respond("Globe le jaane me problem aayi.", false); }
    };
  }
  return null;
}

function sysPromptNatural(lang) {
  return `You are ADA, Saket's personal AI — his co-pilot and friend, running the God's Eye command center. You talk to him EXACTLY like a close human friend would:
- Reply in plain natural speech — the SAME language he used (Hindi→Hindi, Hinglish→Hinglish, English→English). Match his vibe.
- NEVER use any markdown: no asterisks, no *, no **, no backticks, no dashes as bullets, no # headings, no tables, no links. Just plain sentences, like WhatsApp chat between friends. Because your words get spoken out loud.
- Warm, confident, a little playful — like a smart best friend. Short answers usually (1-4 sentences). Only go long if he asks for detail.
- You have LIVE DATA below and TOOLS. Use them for anything current — cite real numbers naturally in your sentences, like "bhai abhi tak 42 flights ud rahi hain".
- For big jobs, use the queue_task tool. For OS actions (open apps, lock, alarms), use os_run. Live data questions: use the data tools. General knowledge: answer directly from your brain.
- If asked who you are: you're ADA, named for Ada Lovelace, and you run his world-monitoring setup.
- Never say you can't do something before trying your tools. After tools run, you'll get results — then give the final natural answer.`;
}

/* ---- the AI brain answer → agent loop with natural persona ---- */
async function aiAnswer(userText, lang) {
  convo.busy = true;
  $("#comms-mode").textContent = "SOCH RAHI HOON";
  try {
    if (!AI.ready()) throw new Error("AI core offline");
    const out = await AGENT.run(userText, lang, {
      log: () => { },
      onStep: (n, tool) => { $("#comms-mode").textContent = tool.toUpperCase(); },
      sysPromptOverride: sysPromptNatural(lang),
    });
    convo.history.push({ role: "user", content: userText }, { role: "assistant", content: out });
    if (convo.history.length > 12) convo.history = convo.history.slice(-12);
    respond(out, true);
  } catch (e) {
    chatMsg("AI core offline hai. Free AI ke liye ek baar Puter sign-in popup aayega (email/Google, free) — phir main poori tarah baat kar paungi. Tab tak local commands chal rahi hain.", "ada");
  } finally {
    convo.busy = false;
    $("#comms-mode").textContent = listening ? "SUN RAHI HOON" : "STANDBY";
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
