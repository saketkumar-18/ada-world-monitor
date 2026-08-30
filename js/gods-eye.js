/* ADA — GOD'S EYE module: 3D globe (globe.gl) with live flights,
 * Starlink satellites (TLE + satellite.js propagation), quakes, ISS.
 * Self-hosted assets. Zero keys.
 */
"use strict";

const GODSEYE = (() => {

  let globe = null, ready = false;
  const state = {
    flights: [],        // [{cs,lat,lon,alt,track,spd,type,mil}]
    sats: [],           // [{name,lat,lon,alt}]
    quakes: [],         // [{mag,place,lat,lon,time}]
    iss: null,
    issPath: [],
    satrecs: [],        // parsed TLEs
  };
  const layers = { flights: true, sats: true, quakes: true, iss: true, choke: true };
  const CHOKE = [
    ["Strait of Hormuz", 26.57, 56.25], ["Suez Canal", 30.42, 32.35],
    ["Panama Canal", 9.08, -79.68], ["Strait of Malacca", 2.5, 101.5],
    ["Bab el-Mandeb", 12.58, 43.33], ["Taiwan Strait", 24.5, 119.5],
    ["Bosphorus", 41.1, 29.05], ["Danish Straits", 55.7, 11.0],
  ];

  /* ---------- data fetchers ---------- */

  function parseAdsbJson(text) {
    // direct API returns pure JSON; jina proxy wraps with "Title:...\n\nMarkdown Content:\n"
    let t = String(text);
    const md = t.indexOf("Markdown Content:");
    if (md >= 0) t = t.slice(md + "Markdown Content:".length);
    // strip any markdown escapes jina adds (\' etc) — adsb json is clean apart from wrapper
    return JSON.parse(t.trim());
  }

  async function fetchFlights(lat = 28.6, lon = 77.2) {
    // adsb.lol blocks generic browser UAs; browser fetch may fail -> jina.ai proxy fallback
    for (const url of [
      `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/400`,
      `https://r.jina.ai/https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/400`,
    ]) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 15000);
        const r = await fetch(url, { signal: c.signal });
        clearTimeout(t);
        if (!r.ok) continue;
        const d = parseAdsbJson(await r.text());
        state.flights = (d.ac || []).filter(a => a.lat && a.lon).map(a => ({
          cs: (a.flight || a.callsign_t || a.hex || "??").trim(),
          lat: a.lat, lon: a.lon,
          alt: typeof a.alt_baro === "number" ? a.alt_baro : 0,
          track: a.track || 0, spd: a.gs || 0,
          type: a.t || "?", hex: a.hex,
        }));
        if (state.flights.length) return;
      } catch (e) { /* try next path */ }
    }
  }

  async function fetchMilFlights(lat = 28.6, lon = 77.2) {
    for (const url of [
      `https://api.adsb.lol/v2/mil/lat/${lat}/lon/${lon}/dist/600`,
      `https://r.jina.ai/https://api.adsb.lol/v2/mil/lat/${lat}/lon/${lon}/dist/600`,
    ]) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 15000);
        const r = await fetch(url, { signal: c.signal });
        clearTimeout(t);
        if (!r.ok) continue;
        const d = parseAdsbJson(await r.text());
        const mil = (d.ac || []).filter(a => a.lat && a.lon).map(a => ({
          cs: (a.flight || "MIL").trim(), lat: a.lat, lon: a.lon,
          alt: typeof a.alt_baro === "number" ? a.alt_baro : 0,
          track: a.track || 0, spd: a.gs || 0, type: a.t || "?", hex: a.hex, mil: true,
        }));
        if (mil.length) {
          const civ = state.flights.filter(f => !f.mil);
          state.flights = [...civ, ...mil];
          return;
        }
      } catch (e) { }
    }
  }

  async function fetchTLEs() {
    try {
      const r = await fetch("https://huggingface.co/datasets/juliensimon/starlink-tle-latest/resolve/main/data/starlink.tle");
      const t = await r.text();
      const lines = t.split("\n").map(l => l.replace(/\r/, ""));
      const recs = [];
      for (let i = 0; i + 2 < lines.length; i += 3) {
        if (lines[i + 1][0] === "1" && lines[i + 2][0] === "2") {
          try {
            recs.push({ name: lines[i].trim(), rec: satellite.twoline2satrec(lines[i + 1], lines[i + 2]) });
          } catch (_) { }
        }
      }
      state.satrecs = recs;
      return recs.length;
    } catch (e) { return 0; }
  }

  function propagateSats(now = new Date()) {
    const out = [];
    if (!state.satrecs.length) return 0;
    const step = Math.max(1, Math.floor(state.satrecs.length / 700)); // cap ~700 for perf
    for (let i = 0; i < state.satrecs.length; i += step) {
      const { name, rec } = state.satrecs[i];
      try {
        const pv = satellite.propagate(rec, now);
        if (!pv || !pv.position || pv.position.x == null) continue; // guard: null positions
        const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(now));
        if (gd == null || gd.latitude == null) continue;
        out.push({ name, lat: satellite.degreesLat(gd.latitude), lon: satellite.degreesLong(gd.longitude), alt: gd.height });
      } catch (_) { }
    }
    state.sats = out;
    return out.length;
  }

  async function fetchISS() {
    try {
      const r = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
      const d = await r.json();
      state.iss = { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity };
      return state.iss;
    } catch (e) { return null; }
  }

  /* ---------- globe ---------- */

  function init(containerId, onPoint) {
    if (typeof Globe === "undefined") return false;
    try {
      globe = Globe({ animateIn: true })(document.getElementById(containerId))
        .globeImageUrl("vendor/earth-night.jpg")
        .bumpImageUrl("vendor/earth-dark.jpg")
        .backgroundImageUrl("vendor/night-sky.png")
        .showAtmosphere(true)
        .atmosphereColor("#35e0ff")
        .atmosphereAltitude(0.18)
        .width("100%").height("100%");

      // chokepoints — red beacons
      globe.labelsData(layers.choke ? CHOKE.map(([n, lat, lon]) => ({ name: n, lat, lon })) : [])
        .labelLat(d => d.lat).labelLng(d => d.lon)
        .labelText(d => d.name)
        .labelColor(() => "rgba(255,77,94,.9)")
        .labelSize(0.6).labelDotRadius(0.35).labelResolution(1);

      globe.onGlobeClick && globe.onGlobeClick(({ lat, lng }, event) => {
        onPoint && onPoint(lat, lng);
      });

      ready = true;
      return true;
    } catch (e) {
      console.error("globe init fail", e);
      return false;
    }
  }

  /* ---------- render layers ---------- */

  function renderFlights() {
    if (!globe) return;
    const data = layers.flights ? state.flights : [];
    globe.objectsData(data)
      .objectLat(d => d.lat).objectLng(d => d.lon).objectAltitude(d => Math.min(0.12, d.alt / 120000))
      .objectFaces(() => [[0, 0, -1], [0.7, 0, 0.7], [-0.7, 0, 0.7]])
      .objectColor(d => d.mil ? "rgba(255,77,94,.95)" : "rgba(53,224,255,.85)")
      .objectLabel(d => `${d.mil ? "🎖 " : ""}${d.cs}<br><span style="color:#54687c">${d.type} · ${Math.round(d.alt)} ft · ${Math.round(d.spd)} kt · hdg ${Math.round(d.track)}°</span>`)
      .onObjectClick(obj => obj && obj.__data && window.open(`https://globe.adsb.lol/?icao=${obj.__data.hex}`, "_blank"));
  }

  function renderSats() {
    if (!globe) return;
    const data = layers.sats ? state.sats : [];
    globe.customLayerData(data)
      .customLayerLat(d => d.lat).customLayerLng(d => d.lon).customLayerAltitude(d => d.alt / 6371)
      .customThreeObject(() => {
        // tiny point sprite
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
        const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.75 });
        return new THREE.Points(geo, mat);
      })
      .customThreeObjectUpdate((obj, d) => {
        obj.__data = d;
        Object.assign(obj.position, globe.getCoords(d.lat, d.lon, d.alt / 6371 + 1.02));
      });
  }

  function renderQuakes() {
    if (!globe) return;
    const data = layers.quakes ? state.quakes : [];
    globe.ringsData(data)
      .ringLat(d => d.lat).ringLng(d => d.lon)
      .ringMaxRadius(d => Math.max(2, (d.mag || 3) * 1.6))
      .ringPropagationSpeed(d => 1.5).ringRepeatPeriod(d => 900)
      .ringColor(() => t => `rgba(255,180,84,${Math.max(0, 1 - t)})`);
  }

  function renderISS() {
    if (!globe) return;
    const paths = [];
    if (layers.iss && state.issPath.length > 1) {
      paths.push({ pts: state.issPath.map(p => [p.lat, p.lon]) });
    }
    globe.pathsData(paths)
      .pathPoints(d => d.pts).pathPointLat(p => p[0]).pathPointLng(p => p[1])
      .pathColor(() => "rgba(53,224,255,.7)").pathTransitionDuration(0);

    // ISS marker via labels? use html elements data
    if (layers.iss && state.iss) {
      globe.htmlElementsData([{ lat: state.iss.lat, lng: state.iss.lon }])
        .htmlLat(d => d.lat).htmlLng(d => d.lng)
        .htmlElement(() => {
          const el = document.createElement("div");
          el.innerHTML = '<div style="width:10px;height:10px;border:1px solid #fff;background:#35e0ff;border-radius:2px;box-shadow:0 0 10px #35e0ff;"></div>';
          el.style.pointerEvents = "none";
          return el;
        });
    } else {
      globe.htmlElementsData([]);
    }
  }

  function flyTo(lat, lng, alt = 1.8) {
    if (globe) globe.pointOfView({ lat, lng, altitude: alt }, 1200);
  }

  function setLayer(key, on) {
    layers[key] = on;
    renderFlights(); renderSats(); renderQuakes(); renderISS();
  }

  function counts() {
    return {
      flights: state.flights.length,
      milFlights: state.flights.filter(f => f.mil).length,
      sats: state.sats.length,
      totalSats: state.satrecs.length,
      quakes: state.quakes.length,
      iss: state.iss ? { lat: state.iss.lat, lon: state.iss.lon, alt: state.iss.alt } : null,
    };
  }

  return {
    init, ready: () => ready, layers, setLayer, flyTo, counts,
    fetchFlights, fetchMilFlights, fetchTLEs, propagateSats, fetchISS,
    state, renderFlights, renderSats, renderQuakes, renderISS, CHOKE,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = GODSEYE;
