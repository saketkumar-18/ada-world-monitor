/* ADA v3 — AGENT LOOP: the JARVIS engine.
 * Multi-step: AI plans → calls tools → observes results → loops (max 6 steps)
 * → final spoken answer. Works with native tool-calls AND text-mode fallback
 * (JSON protocol) for models without function-calling.
 */
"use strict";

const AGENT = (() => {

  const MAX_STEPS = 6;

  function sysPrompt(lang, toolsText) {
    return `You are ADA (Autonomous Digital Assistant), operator Saket's personal AI co-pilot inside the ADA World Monitor command center — like JARVIS.
CAPABILITIES: You control real executable TOOLS. To use one, reply with ONLY a JSON object (no markdown fences, no prose):
{"tool":"<name>","args":{...}}
After each tool result you get another turn. Chain tools freely (max ${MAX_STEPS} steps) to fully complete the task — search, read pages, fetch live data, compute, remember, control the dashboard. Only when the task is fully done, reply with plain text (NO JSON) — the final answer for the operator.
LANGUAGE: Detect the operator's language and reply in THAT language (Hindi question → Hindi answer, Hinglish → Hinglish). Final answers: concise, mission-control tone, cite live numbers exactly. If a tool fails, say what failed and answer with what you have.
TOOLS:
${toolsText}`;
  }

  function parseToolCall(out) {
    // strip markdown fences if any
    const s = out.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    if (!(s.startsWith("{") && s.endsWith("}"))) return null;
    try {
      const o = JSON.parse(s);
      if (o && typeof o.tool === "string") return o;
    } catch (_) { }
    return null;
  }

  /* one agent run: returns final text */
  async function run(userText, lang, ui) {
    if (!AI.ready()) throw new Error("AI core offline");

    // log helper no-ops if ui missing
    const L = ui ? ui.log : () => { };
    const onStep = ui ? ui.onStep : () => { };
    const sysText = (ui && ui.sysPromptOverride) ? ui.sysPromptOverride : sysPrompt;

    const toolsText = TOOLS.manifest();
    const messages = [
      { role: "system", content: sysText(lang, toolsText) },
      { role: "system", content: "[LIVE DATA NOW]\n" + AI.liveBlock(S) },
      { role: "user", content: userText },
    ];

    for (let step = 1; step <= MAX_STEPS; step++) {
      let out;
      try { out = await AI.chat(messages, {}); }
      catch (e1) {
        L("warn", "[AI]", "primary model down — fallback");
        out = await AI.chat(messages, { model: AI.LM_FALLBACK });
      }
      out = String(out).trim();

      const call = parseToolCall(out);
      if (!call) return out; // final answer

      const name = call.tool, args = call.args || {};
      L("info", "[TOOL]", `step ${step}: ${name}(${JSON.stringify(args).slice(0, 80)})`);
      onStep(step, name);
      const result = await TOOLS.call(name, args);
      L(result.error ? "warn" : "ok", "[TOOL]", name + " → " + (result.error ? result.error : JSON.stringify(result).slice(0, 120)));

      messages.push({ role: "assistant", content: out });
      messages.push({ role: "user", content: "TOOL RESULT for " + name + ":\n" + JSON.stringify(result).slice(0, 3500) + "\n\nContinue. If the task is complete, give the final plain-text answer now." });
    }
    // exhausted steps: force a final answer
    messages.push({ role: "user", content: "Step limit reached. Give the final plain-text answer now." });
    return String(await AI.chat(messages, { model: AI.LM_FALLBACK })).trim();
  }

  return { run, MAX_STEPS };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AGENT;
