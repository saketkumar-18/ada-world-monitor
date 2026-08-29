# ADA World Monitor

> Real-time global intelligence dashboard — earthquakes, space weather, crypto markets, world news, orbital tracking, launches and climate on one dark ops map.
> **100% free APIs. Zero keys. Zero build. Zero backend.** Inspired by [koala73/worldmonitor](https://github.com/koala73/worldmonitor), rebuilt lite.

**Live:** https://saketkumar-18.github.io/ada-world-monitor/

## The killer feature: voice

Press **V** (or the voice button), then say:

- *"ADA briefing"* — full spoken situation report compiled from all live feeds
- *"ADA quakes"* — latest seismic events
- *"ADA bitcoin"* — market snapshot
- *"ADA weather Mumbai"* — live weather for any city
- *"ADA where is the ISS"* — orbital telemetry
- *"ADA space weather"* — geomagnetic storm status
- *"ADA news"* — top headlines
- *"ADA next launch"* — upcoming rocket launch

ADA **speaks back** via TTS. The **Morning Briefing** button compiles quakes + space weather + markets + climate + top story + next launch into one spoken report.

## Live data feeds (all free, all CORS-open, verified)

| Feed | Source | Refresh |
|---|---|---|
| Earthquakes M2.5+ (24h) | USGS | 120 s |
| ISS position + orbit trail | wheretheiss.at | 15 s |
| Geomagnetic Kp index (30 readings) | NOAA SWPC | 120 s |
| BTC / ETH / SOL prices + 24h change | CoinGecko | 120 s |
| World news | BBC World (via rss2json) | 120 s |
| Tech news | BBC Technology | 120 s |
| Current events (OSINT) | Wikipedia Portal:Current events | 120 s |
| Upcoming launches | Launch Library 2 | 120 s |
| Climate + AQI (Delhi) | Open-Meteo | 120 s |
| Hacker News top | Firebase HN API | 120 s |

## Features

- **Dark ops Leaflet map** — quakes sized/colored by magnitude, ISS live icon + dashed orbit trail, 8 strategic chokepoints (Hormuz, Suez, Malacca, Taiwan Strait…)
- **Layer toggles** — QUAKES / ISS / CHOKEPOINTS on/off
- **Space weather monitor** — 30-reading Kp bar chart with storm-level color coding
- **Markets panel** — BTC/ETH/SOL with 24h change
- **Climate panel** — Delhi temp/wind/humidity/AQI/PM2.5/sky
- **Intelligence feed** — 3 tabs (WORLD / TECH / EVENTS), severity auto-tagged by keywords (war/attack → HIGH)
- **Terminal** — full command interface, type `help`
- **Voice** — Web Speech recognition + TTS, en-IN
- **Boot sequence** — cinematic cold start
- **Responsive** — single column under 1100px

## Run

```bash
# any static server
npx serve .
# or just open index.html in a browser
```

## Test

```bash
node tests/run.js   # 27 live-API tests + syntax checks
```

## Stack

Single page, no build step: HTML + CSS + vanilla JS (2 modules) + Leaflet 1.9.4 (pinned, SRI). ~50KB total.

## Attribution

- Earthquake data: USGS earthquake hazards program
- ISS: wheretheiss.at
- Space weather: NOAA SWPC
- Weather/AQI: Open-Meteo
- Markets: CoinGecko
- News: BBC RSS (via rss2json)
- OSINT: Wikipedia Portal:Current events
- Launches: Launch Library 2 (thespacedevs)
- Tech: Hacker News
- Tiles: OpenStreetMap contributors, CARTO

## License

MIT
