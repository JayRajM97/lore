# Lore — TTS Playground (Phase 1)

A throwaway-grade playground to validate text-to-speech on an Apple Silicon Mac —
speed, quality, latency — before building the real Lore product
(Gmail → newsletter → podcast).

- **Web** (Next.js): split-pane. Paste text left, MP3 player + timing stats right.
- **Mobile** (Expo / React Native): the same flow on a phone, over wifi.
- **Sidecar** (FastAPI): loads the TTS model once, synthesizes, encodes MP3, serves audio.
  It is the single source of truth for both clients.

```
Web (Next /api proxy) ─┐
                       ├─▶ FastAPI sidecar :8000 ─▶ Kokoro-82M + ffmpeg
Expo RN (LAN IP) ──────┘
```

## TTS engine: Kokoro (local, fast)

The sidecar runs **Kokoro-82M** — small and **near-realtime on a Mac** (CPU/MPS).

> We started on **Maya1** (3B, emotion TTS) but it is far too slow to run locally on
> Apple Silicon: a ~16-word clip took *several minutes* on MPS and the web request timed
> out at the 5-minute proxy limit. Maya1 is the right model for **production on a cloud GPU**
> (Modal/RunPod + vLLM = near-realtime, full quality). The sidecar keeps a clean REST
> contract (`/synthesize`, `/audio/{id}`) so swapping Kokoro→Maya1 later is just a URL change.

---

## 1. Python sidecar

**Kokoro requires Python 3.10–3.12 (NOT 3.13).** Use 3.12:

```bash
brew install python@3.12
# from repo root
python3.12 -m venv venv
source venv/bin/activate
pip install -r sidecar/requirements.txt
```

System binaries (not pip):

```bash
brew install ffmpeg espeak-ng     # ffmpeg = MP3 encode, espeak-ng = Kokoro G2P fallback
```

First run downloads the Kokoro model + voices (~few hundred MB, not GBs).

Start it:

```bash
cd sidecar
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Startup logs the device, e.g. `[lore] ready. device=mps` (falls back to CPU if MPS init fails).

Health check:

```bash
curl -s localhost:8000/health      # {"status":"ok","device":"mps","ready":true}
```

### Voices

Kokoro uses **named voices**, not free-form descriptions. The `description` field is mapped
heuristically (contains "female"/"woman" → `af_heart`, else default male `am_michael`).
You can also pass an explicit `"voice"` in the request body (e.g. `am_adam`, `af_bella`).
Full list: Kokoro-82M `VOICES.md` on HuggingFace.

---

## 2. Web app (Next.js)

```bash
npm install
npm run dev          # http://localhost:3000
```

API routes proxy to the sidecar at `SIDECAR_URL` (default `http://localhost:8000`).

### One-command startup

```bash
./start.sh           # runs the sidecar (background) + Next.js dev together
```

---

## 3. Mobile app (Expo / React Native)

```bash
cd mobile
npm install
npx expo start       # scan the QR with Expo Go, or press i / a
```

The phone calls the sidecar **directly** over wifi, so set the Mac's LAN IP in
`mobile/config.ts`:

```ts
export const SIDECAR_URL = "http://192.168.1.50:8000";   // <- your Mac's LAN IP
```

Find it: `ipconfig getifaddr en0`. Phone and Mac must share wifi. `localhost` won't work
from the phone.

---

## How it works

- `POST /synthesize {text, description, voice?}` → Kokoro synthesizes 24 kHz PCM →
  ffmpeg → MP3 in `/tmp` → returns
  `{ id, audio_url, voice, generation_time_ms, audio_duration_s, word_count }`.
- `GET /audio/{id}` → streams the MP3 with HTTP **range** support (scrubbing/seek).
- Web routes (`/api/generate`, `/api/audio/[id]`, `/api/health`) are thin same-origin proxies
  so the browser sees no CORS / mixed-content. Mobile skips the proxy and hits the sidecar.

Generated MP3s live in `/tmp`, cleared on machine restart — no DB, all ephemeral.

---

## Phase 1 checklist

- [x] Paste text → Convert → audio plays (web)
- [x] Generation time / duration / ratio show real measured values
- [x] play / pause / ±15s / speed / download all work
- [x] sidecar-down → error state with the startup command
- [ ] mobile flow on a phone over wifi (code ready; needs your LAN IP)

Phase 2 (word-sync highlighting) is deferred — the layout is built to add it without rework.
