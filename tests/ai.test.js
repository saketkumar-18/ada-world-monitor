/* AI layer test — new puter-first architecture.
 * In Node: puter.js is not loaded (browser-only), pollinations may 402 (IP-limited anonymous tier).
 * So this test verifies the fallback chain and non-LLM tools; LLM text-gen is verified live in browser.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ctx = { fetch, AbortController, setTimeout, clearTimeout, console, puter: undefined, window: {} };
vm.createContext(ctx);
const code = fs.readFileSync(path.join(__dirname, "..", "js", "ai.js"), "utf8")
  .replace(/if \(typeof module[\s\S]*$/, "");
vm.runInContext(code + "\n;this.__AI=AI;", ctx);
const AI = ctx.__AI;

let p = 0, f = 0;
const t = (n, c, e) => { if (c) { p++; console.log("PASS", n); } else { f++; console.log("FAIL", n, e || ""); } };

(async () => {
  t("ready() false without puter", AI.ready() === false);
  t("signedIn() false without puter", AI.signedIn() === false);
  try { await AI.ensureSignIn(); t("ensureSignIn throws without puter", false); }
  catch (e) { t("ensureSignIn throws without puter", true); }

  try {
    const out = await AI.chat([{ role: "user", content: "one word: hello" }], {});
    t("unified chat returns text", typeof out === "string" && out.length > 0, JSON.stringify(out).slice(0, 60));
  } catch (e) {
    // expected in Node when puter is absent and pollinations IP-limit 402s: error must mention both providers
    const m = String(e.message);
    t("unified chat error names both providers (fallback chain intact)", m.includes("puter") && m.includes("pollinations"), m.slice(0, 120));
  }

  try {
    const w = await AI.wiki("भारत", "hi");
    t("wiki hindi", w && w.extract && w.extract.length > 30);
  } catch (e) { t("wiki hindi", false, e.message.slice(0, 60)); }

  try {
    const r = await AI.fx("USD", "INR");
    t("fx", r.rates && r.rates.INR > 50);
  } catch (e) { t("fx", false, e.message.slice(0, 60)); }

  console.log("\nRESULT:", p, "passed,", f, "failed");
  process.exit(f ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
