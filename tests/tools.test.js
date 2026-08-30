/* ADA v3 — tool-layer test suite (Node, live APIs). */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };
const ctx = {
  console, fetch, AbortController, setTimeout, clearTimeout,
  window: {}, localStorage,
  log: () => {}, respond: () => {}, morningBriefing: async () => "brief", refreshAll: () => {},
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "tools.js"), "utf8") + "\n;this.__T=TOOLS;", ctx);
const T = ctx.__T;

let p = 0, f = 0;
const t = (n, c, e) => { if (c) { p++; console.log("PASS", n); } else { f++; console.log("FAIL", n, e || ""); } };

(async () => {
  // syntax of all modules
  for (const mod of ["js/tools.js", "js/agent.js", "js/brain.js", "js/app.js", "js/ai.js"]) {
    try { new Function(fs.readFileSync(path.join(__dirname, "..", mod), "utf8")); t(mod + " parses", true); }
    catch (e) { t(mod + " parses", false, e.message); }
  }

  t("registry has 20+ tools", T.names().length >= 20, T.names().length);
  t("manifest text", T.manifest().length > 500);
  t("schemas array", Array.isArray(T.schemas()) && T.schemas().length === T.names().length);

  const w = await T.call("weather", { city: "Mumbai" }); t("weather mumbai", w.temp_c != null, JSON.stringify(w).slice(0, 80));
  const q = await T.call("quakes", { limit: 3 }); t("quakes", q.quakes && q.quakes.length > 0);
  const i = await T.call("iss", {}); t("iss", i.alt_km > 300);
  const fxr = await T.call("fx", { base: "USD", symbols: "INR" }); t("fx usd inr", fxr.rates && fxr.rates.INR > 50);
  const k = await T.call("space_weather", {}); t("kp", k.kp_now >= 0);
  const c = await T.call("calc", { expression: "(23*4.5)+sqrt(144)" }); t("calc", Math.abs(c.result - 115.5) < 0.01, c.result);
  const cv = await T.call("convert", { value: 5, from: "km", to: "miles" }); t("convert km->mi", Math.abs(cv.result - 3.107) < 0.01, cv.result);
  const tf = await T.call("convert", { value: 100, from: "c", to: "f" }); t("convert c->f", tf.result === 212, tf.result);
  const n = await T.call("news", { topic: "world", limit: 3 }); t("news", n.headlines && n.headlines.length > 0);
  const la = await T.call("launches", { limit: 2 }); t("launches", la.launches && la.launches.length > 0);
  const wi = await T.call("wiki", { query: "भारत" }); t("wiki hindi", wi.extract && wi.extract.length > 30);
  const ws = await T.call("web_search", { query: "India latest news" }); t("web_search", ws.results && ws.results.length > 0, JSON.stringify(ws).slice(0, 100));
  const ru = await T.call("read_url", { url: "https://en.wikipedia.org/wiki/Ada_Lovelace" }); t("read_url", ru.content && ru.content.length > 500);
  const rm = await T.call("remember", { text: "Saket likes chai" }); t("remember", rm.saved);
  const rc = await T.call("recall", {}); t("recall", rc.notes.some(x => x.note === "Saket likes chai"));
  const td = await T.call("todo", { action: "add", text: "test task" }); t("todo add", td.todos.some(x => x.t === "test task"));
  const td2 = await T.call("todo", { action: "done", index: 0 }); t("todo done", td2.todos[0].done === true);
  const tn = await T.call("time_now", { tz: "Asia/Kolkata" }); t("time_now", tn.time && tn.iso);
  const mg = await T.call("map_go", { place: "Tokyo" }); t("map_go graceful (no map)", mg.error === "map offline", JSON.stringify(mg));
  const bad = await T.call("nonexistent", {}); t("unknown tool error", bad.error && bad.error.includes("unknown tool"));
  const badw = await T.call("weather", { city: "xyzzynotacity" }); t("weather bad city error", badw.error === "city not found");
  const ml = await T.call("map_layer", { layer: "quakes", on: false }); t("map_layer graceful", ml.error === "map offline");

  // agent loop test: fake AI returns a tool-call JSON first, then a final answer
  const fakeAI = {
    ready: () => true,
    liveBlock: () => "test_live:data",
    chat: async (msgs) => {
      if (!fakeAI.n) { fakeAI.n = 1; return JSON.stringify({ tool: "calc", args: { expression: "2+2" } }); }
      return "The answer is 4.";
    },
  };
  const agentCtx = { console, fetch, AbortController, setTimeout, clearTimeout, window: {}, localStorage, AI: fakeAI, TOOLS: T, S: {} };
  vm.createContext(agentCtx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "agent.js"), "utf8"), agentCtx);
  const out = await vm.runInContext("AGENT.run('what is 2+2? use the calc tool','en-IN',{log:()=>{},onStep:()=>{}})", agentCtx);
  t("agent loop: tool call + final answer", out === "The answer is 4.", JSON.stringify(out).slice(0, 80));

  console.log("\nRESULT:", p, "passed,", f, "failed");
  process.exit(f ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
