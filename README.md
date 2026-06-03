# Lore

**Turn your newsletters into a podcast — automatically.**

Lore connects to your Gmail, detects newsletters, fetches the latest issue from each one you follow, and converts them to audio using a local TTS engine. You get a personal podcast feed of the newsletters you actually want to read but never do.

```
Gmail → newsletter detection → text extraction → TTS synthesis → podcast feed
```

---

## Architecture

Three surfaces, one sidecar:

```
Web (Next.js)      ─┐
                    ├─▶  FastAPI sidecar :8000  ─▶  Kokoro-82M  ─▶  MP3
Mobile (Expo/RN)   ─┘
```

The **FastAPI sidecar** is the single source of truth. It loads the TTS model once, synthesizes audio, and serves it. Both clients hit the same REST contract (`POST /synthesize`, `GET /audio/{id}`), so swapping the local Kokoro model for a cloud GPU (Modal/RunPod) later is a one-line URL change.

---

## What's inside

| Surface | Stack | Status |
|---------|-------|--------|
| **Mobile** | Expo · React Native · expo-router | ✅ Full flow: Gmail auth → scan → discover → TTS generation → player |
| **Web playground** | Next.js 14 · Tailwind | ✅ Paste text → convert → play with word-sync highlight |
| **Sidecar** | FastAPI · Kokoro-82M · ffmpeg | ✅ `/synthesize` + range-aware audio stream |
| **Backend** | FastAPI + Firebase Admin | 🔧 Gmail OAuth + Firestore sync (in progress) |

---

## Mobile app

The real product. Full flow:

1. **Onboarding** — splash + intro screen
2. **Gmail connect** — Google OAuth (expo-auth-session), read-only scope
3. **Inbox scan** — scans last 90 days, detects newsletters by unsubscribe headers, ESP domain, and subject patterns
4. **Discover** — pick which newsletters to follow; persists to Firestore
5. **Generating** — fetches latest email body per newsletter → strips HTML → POSTs to sidecar → gets back MP3 + word timestamps
6. **Home feed** — real episodes; tap to play
7. **Player** — scrubbing, speed control, word-sync lyrics view

### Setup

```bash
cd mobile && npm install
```

Set your Mac's LAN IP in `mobile/lib/config.ts`:

```ts
export const BACKEND_URL = "http://192.168.x.x:8000";
```

```bash
npx expo start            # iOS / Android via Expo Go or dev build
npx expo start --web      # browser at localhost:8081
```

> **Web OAuth:** `http://localhost:8081` must be added as an Authorized JavaScript Origin **and** Authorized Redirect URI in Google Cloud Console → Web client OAuth 2.0 credential.

---

## Sidecar (TTS engine)

Requires **Python 3.10–3.12** (Kokoro pins `<3.13`):

```bash
python3.12 -m venv venv && source venv/bin/activate
pip install -r sidecar/requirements.txt
brew install ffmpeg espeak-ng
```

```bash
cd sidecar && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Health check: `curl localhost:8000/health`

First run downloads Kokoro-82M weights (~300 MB). Subsequent starts are fast.

### API

```
POST /synthesize
  { "text": "...", "voice"?: "af_heart", "description"?: "female narrator" }
  → { id, audio_url, voice, generation_time_ms, audio_duration_s, word_count, words[] }

GET  /audio/{id}    — range-aware MP3 stream (scrubbing works)
GET  /health
```

---

## Web playground

```bash
npm install && npm run dev     # http://localhost:3000
./start.sh                     # sidecar (bg) + Next.js together
```

Paste any text, pick a voice, hit Convert. The player highlights each word as it's spoken using word-level timestamps from the sidecar. Good for tuning voice/speed before wiring the real pipeline.

---

## TTS model choice

| Model | Where | Speed (M-series) | Quality |
|-------|-------|-----------------|---------|
| **Kokoro-82M** | Local sidecar | Near-realtime | Good — American English |
| **Maya1 3B** | Cloud GPU (target) | Minutes locally — too slow | High, emotion TTS |

Kokoro runs locally for fast iteration. Maya1 is the production target on Modal/RunPod — the sidecar REST contract is identical so the swap is transparent to both clients.

---

## Roadmap

- [ ] Persist generated episodes to Firestore (survive app restart)
- [ ] Background generation on the backend server
- [ ] Library and saved episodes
- [ ] Playback progress sync across devices
- [ ] Push notification when a new issue drops
- [ ] Production TTS on cloud GPU (Maya1 / Modal)
