# ADA World Monitor

> Real-time global intelligence dashboard **with a full AI brain** — ask anything, in any language, by voice or text. Live data (earthquakes, space weather, markets, news, ISS, launches, FX, weather) is injected into every AI answer.
> **Free. Zero API keys. Zero backend. Zero build.**

**Live:** https://saketkumar-18.github.io/ada-world-monitor/

## The AI brain

ADA answers **any question** — science, history, math, code, current events, live world data — in **any language you speak**.

| Layer | What it does |
|---|---|
| **Puter.js LLM** (GPT / Claude / Gemini, free, no API keys) | General knowledge, reasoning, any-language replies |
| **Live-data injection** | Every question carries a snapshot of all 8 live feeds + FX, so live questions get exact current numbers |
| **Wikipedia knowledge** (18 languages) | Entity facts pulled in real time as extra context |
| **Language auto-detect** | Detects Hindi/English/Japanese/Chinese/Korean/Arabic/Russian/Thai (+ Devanagari, Hinglish) — recognition, reply, and voice all follow the language you spoke |
| **Local fast-path** | Instant spoken answers for `briefing`, `quakes`, `bitcoin`, `iss`, `weather <city>`, `fx usd to inr` — no LLM round-trip |
| **Model fallback** | If the primary model fails, ADA auto-switches to the fallback model |

### Voice loop
Press **V** — ADA listens continuously, answers, and reopens the mic automatically. Speak Hindi, Hinglish, English — anything. Say "chup" or press **V** to stop.

> Note: the free AI (Puter.js) shows a **one-time sign-in popup** (email/Google — free account) on your first AI question. That's Puter's free-tier model: no keys for you, they meter per-user. Local commands, all feeds, map, and briefing work without it.

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
npx serve .          # run
node tests/run.js    # 36 live-API tests + syntax + language-detect checks
```

## Stack

Vanilla JS (4 modules) + Leaflet 1.9.4 (self-hosted) + Puter.js (AI). ~90KB. No build step, no backend, no keys.

## License

MIT
