# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Lore** — a TTS playground that validates text-to-speech locally before building the real
Lore product (Gmail → newsletter → podcast). Paste text, convert to audio, play it with
word-by-word highlight sync. Two clients (web + mobile) share one Python TTS sidecar.

## Commands

```bash
# Python sidecar — REQUIRES Python 3.10–3.12 (NOT 3.13; Kokoro pins <3.13)
python3.12 -m venv venv && source venv/bin/activate
pip install -r sidecar/requirements.txt
brew install ffmpeg espeak-ng          # system deps: MP3 encode + Kokoro G2P

# Run sidecar (loads Kokoro once, ~near-realtime on Apple Silicon)
cd sidecar && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Web (Next.js)
npm install && npm run dev             # http://localhost:3000
npx tsc --noEmit                       # typecheck (there is no test suite)

./start.sh                             # sidecar (bg) + web together

# Mobile (Expo) — set Mac LAN IP in mobile/config.ts first
cd mobile && npm install && npx expo start
```

There are no automated tests or linters configured. Verify changes by typechecking the web
(`npx tsc --noEmit`) and smoke-testing the sidecar:
`curl -s localhost:8000/health` then `POST /synthesize`.

## Architecture: three surfaces, one brain

The **FastAPI sidecar is the single source of truth** — it both synthesizes audio and serves
it. Everything else is a thin client. This is deliberate so the same REST contract
(`/synthesize`, `/audio/{id}`) can later point at a cloud-GPU host without touching clients.

```
Web (Next /api proxy) ─┐
                       ├─▶ sidecar :8000 ─▶ Kokoro-82M ─▶ PCM ─▶ ffmpeg ─▶ MP3 in /tmp
Expo RN (Mac LAN IP) ──┘
```

**Generate flow:** browser → `POST /api/generate` ([app/api/generate/route.ts](app/api/generate/route.ts))
→ proxies to sidecar `POST /synthesize` ([sidecar/main.py](sidecar/main.py)) → Kokoro yields
PCM + per-token timestamps → ffmpeg encodes MP3 to `/tmp/lore-{id}.mp3` → returns JSON
`{ id, audio_url, voice, generation_time_ms, audio_duration_s, word_count, words[] }`. The web
route rewrites `audio_url` to `/api/audio/{id}`; [app/api/audio/[id]/route.ts](app/api/audio/[id]/route.ts)
proxies the sidecar's range-aware audio stream (so scrubbing works). The web proxies exist only
to keep the browser same-origin — **mobile skips them and calls the sidecar directly** at the LAN
IP in [mobile/config.ts](mobile/config.ts).

Audio is ephemeral: an in-memory `id → path` map in the sidecar plus files in `/tmp`, both lost on
restart. No database.

## Word-sync highlighting (the non-obvious part)

Two halves that must stay in step:

1. **Backend timing** ([sidecar/main.py](sidecar/main.py) `synthesize_audio_and_words`): Kokoro
   emits one `Result` per text chunk, each with chunk-relative `token.start_ts/end_ts` and a
   `token.whitespace` field. Tokens are grouped into words (a word ends when a token has trailing
   whitespace) and each chunk's timestamps are offset by the cumulative audio duration of prior
   chunks. Returns `words: [{start, end}]` in document order.

2. **Frontend** ([components/WordHighlight.tsx](components/WordHighlight.tsx)): re-tokenizes the
   text preserving whitespace (rendered under `whitespace-pre-wrap` so pasted formatting is kept
   verbatim) and highlights the word whose `[start,end)` contains the current playback time. If
   `words` is absent it falls back to length-weighted linear interpolation.

State wiring lives in [app/page.tsx](app/page.tsx): `currentTime` is lifted out of
[components/AudioPlayer.tsx](components/AudioPlayer.tsx) via an `onProgress` callback, and the
text/voice state is lifted to the page so both panes share it. `syncedText` is frozen at
generation time so the highlight always matches the audio even if the textarea is edited after.

## Key decisions & constraints

- **Kokoro, not Maya1, for local.** Maya1 (3B) was abandoned for local dev — on Apple Silicon MPS
  a short clip took *minutes* and blew the 5-minute proxy timeout. Kokoro-82M is near-realtime.
  Maya1 remains the intended **production** model on a cloud GPU (Modal/RunPod), to be dropped in
  behind the identical sidecar REST contract.
- **Python 3.12 hard requirement** — `kokoro` refuses to install on 3.13.
- **Voices are fixed named Kokoro voices** ([lib/voices.ts](lib/voices.ts)), American-English
  pipeline (`lang_code='a'`). Real-person voice cloning (e.g. specific celebrities) is intentionally
  not supported — Kokoro can't do it and it raises consent/likeness issues. The sidecar also has a
  description→voice heuristic for clients (mobile) that send a free-text `description` instead of a
  `voice` id.
- **Colors are a locked palette** in [tailwind.config.ts](tailwind.config.ts) (teal/indigo/coral/
  amber on warm paper). Reference the named tokens, not raw hexes, in components.
- `SIDECAR_URL` env var overrides the web proxies' sidecar target (default `http://localhost:8000`).

## Status

Phase 1 (convert + player) and Phase 2 (word-sync highlight) are done on web. Mobile mirrors
Phase 1 only. The original specs live in the conversation history, not in-repo.
