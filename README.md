# ADA World Monitor

> **JARVIS-class AI agent in your browser.** ADA doesn't just answer — she *does things*: 22 executable tools, a multi-step agent loop, any-language voice, and a live global intelligence dashboard. Free. Zero keys. Zero backend.

**Live:** https://saketkumar-18.github.io/ada-world-monitor/

## What makes ADA an agent (not a chatbot)

When you ask, the **agent loop** engages: ADA reads your task → picks tools → executes them → observes results → chains more tools (up to 6 steps) → delivers the final spoken answer. You watch every tool fire in the terminal.

### The 22 tools she can execute
| Category | Tools |
|---|---|
| 🌐 Web | `web_search` (live DuckDuckGo) · `read_url` (reads any article) · `open_url` (opens sites for you) |
| 📚 Knowledge | `wiki` (18 languages) · `time_now` (any timezone) |
| 🌍 Live world | `quakes` (USGS) · `weather` · `air_quality` · `fx` (ECB rates) · `crypto` · `space_weather` (Kp) · `iss` · `launches` · `news` (BBC world/tech/business/science) |
| 🧮 Compute | `calc` (math) · `convert` (units/temperature) |
| 🧠 Personal | `remember`/`recall` (persistent memory) · `todo` (task manager) · `alarm` (spoken reminders) |
| 🎛️ Dashboard | `map_go` (fly the map anywhere) · `map_layer` (toggle layers) · `briefing` · `refresh_feeds` |

### Example tasks she handles end-to-end
- *"research karo solar storm ka latest status, aur batao kya risk hai"* → `space_weather` + `web_search` + `read_url` → Hinglish spoken synthesis
- *"Tokyo le chalo map pe"* → map flies to Tokyo
- *"5 baje remind karoyo call karna hai"* → spoken alarm
- *"yad rakhna mujhe elaichi chai pasand hai"* → saved to memory forever
- *" strongest earthquake today aur uske baare me detail do"* → `quakes` → `web_search` → answer with live numbers
- *"mera todo list banao: gym, revision, deploy"* → added

### Any language
Speak Hindi, Hinglish, English, Japanese, Chinese, Korean, Arabic, Russian… — script + keyword detection sets recognition, reply, **and voice** to your language automatically.

### Local fast-path
`briefing` / `quakes` / `bitcoin` / `iss` / `news` / `weather <city>` / `fx usd to inr` answer instantly, no LLM needed.

> The free AI (Puter.js — GPT-5.4-nano primary, Claude Sonnet fallback) shows a **one-time sign-in popup** (email/Google, free) on your first AI question. That's their free-tier model: no API keys for you. Feeds, map, briefing, and local commands work without it.

## Live data feeds (all free, CORS-verified)

| Feed | Source | Refresh |
|---|---|---|
| Earthquakes M2.5+ (24h) | USGS | 120 s |
| ISS position + orbit trail | wheretheiss.at | 15 s |
| Geomagnetic Kp index | NOAA SWPC | 120 s |
| BTC / ETH / SOL | CoinGecko | 120 s |
| FX rates (ECB) | Frankfurter | on demand |
| World/Tech news | BBC (rss2json) | 120 s |
| Current events | Wikipedia Portal | 120 s |
| Weather + AQI any city | Open-Meteo | on demand |
| Launches | Launch Library 2 | 120 s |
| Knowledge (18 langs) | Wikipedia | on demand |

## Try asking

- *"भारत की राजधानी क्या है"* — answers in Hindi
- *"what's the strongest earthquake right now"* — live USGS numbers
- *"explain quantum tunneling"* — pure AI knowledge
- *"dollar ka aaj rate kya hai"* — Hinglish → live FX
- *"stock market summary"* — BBC headlines + AI synthesis
- *"should I worry about the solar storm today"* — live Kp + AI reasoning

## Map

Dark Leaflet ops map: quakes sized by magnitude, ISS live icon + dashed orbit trail, 8 strategic chokepoints (Hormuz, Suez, Malacca, Taiwan Strait…), layer toggles. Leaflet is self-hosted — no CDN dependency.

## Run / Test

```bash
npx serve .               # run
node tests/run.js         # 36 feed + syntax tests
node tests/tools.test.js  # 31 tool + agent-loop tests
```

## Stack

Vanilla JS (4 modules) + Leaflet 1.9.4 (self-hosted) + Puter.js (AI). ~90KB. No build step, no backend, no keys.

## License

MIT
