"""
Lore — TTS sidecar.

Supports two TTS backends selected by environment variable:
  - ElevenLabs API (set ELEVENLABS_API_KEY) — cloud, no GPU required.
    Recommended for production: one audio file per newsletter per day,
    stored in Firebase Storage and reused by every listener.
  - Kokoro-82M local model (default fallback) — near-realtime on Apple
    Silicon MPS, no API cost, good for local dev/testing.

The REST contract (/synthesize, /episode, /audio/{id}) is identical for
both backends — clients don't change.

Run:  uvicorn main:app --host 0.0.0.0 --port 8000
"""

import base64
import io
import json
import os
import re
import time
import uuid
import subprocess
import urllib.parse
import urllib.request
import urllib.error
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

try:
    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KPipeline
    _KOKORO_AVAILABLE = True
except ImportError:
    np = sf = torch = KPipeline = None
    _KOKORO_AVAILABLE = False

import hashlib
from datetime import datetime, timezone

try:
    import firebase_admin
    from firebase_admin import credentials, storage as fb_storage, firestore as fb_firestore
    _FIREBASE_AVAILABLE = True
except ImportError:
    _FIREBASE_AVAILABLE = False

SAMPLE_RATE = 24000
OUTPUT_DIR = os.environ.get("AUDIO_DIR", os.path.expanduser("~/.lore/audio"))
LANG_CODE = "a"  # American English

# Path to Firebase service account key JSON (download from Firebase Console →
# Project Settings → Service Accounts → Generate new private key).
# Set env var or place file at the default path.
SERVICE_ACCOUNT_PATH = os.environ.get(
    "FIREBASE_SERVICE_ACCOUNT",
    os.path.expanduser("~/.lore/firebase-service-account.json"),
)
STORAGE_BUCKET = "lore-10132.firebasestorage.app"

# ── Google OAuth (refresh-token sync) ────────────────────────────────────────
# The web client's secret lives ONLY here (server-side). The mobile/web client
# sends its one-time auth code; we exchange it, keep the refresh token in
# Firestore (gmail_tokens/{sub}, Admin-SDK only), and mint fresh access tokens
# on demand so users never re-consent after the first connect.
GOOGLE_OAUTH_CLIENT_ID = os.environ.get(
    "GOOGLE_OAUTH_CLIENT_ID",
    "331040043777-k2fl6kmhe241v6luslejee8lfvcptg2i.apps.googleusercontent.com",
)
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# ── ElevenLabs config ────────────────────────────────────────────────────────
# Set ELEVENLABS_API_KEY to use the cloud API instead of local Kokoro.
# The key needs only the text-to-speech permission.
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
EL_MODEL = "eleven_turbo_v2_5"   # fast + cheap; swap to eleven_multilingual_v2 for higher quality
EL_API_BASE = "https://api.elevenlabs.io/v1"

# Kokoro voice ID → ElevenLabs voice ID mapping.
# EL voices chosen to match the Kokoro voice's character as closely as possible.
EL_VOICE_MAP: Dict[str, str] = {
    "af_heart":   "21m00Tcm4TlvDq8ikWAM",  # Rachel — warm American female
    "af_bella":   "EXAVITQu4vr4xnSDxMaL",  # Bella  — warm American female
    "af_sky":     "MF3mGyEYCl7XYWbV9V6O",  # Elli   — bright/young female
    "af_nicole":  "piTKgcLEGmPE4e6mEKli",  # Nicole — soft, breathy female
    "am_michael": "pNInz6obpgDQGcFmaJgB",  # Adam   — deep American male
    "am_onyx":    "VR6AewLTigWG4xSOukaG",  # Arnold — authoritative male
    "am_puck":    "TX3LPaxmHKxFdv7VOQHJ",  # Liam   — bright, light male
}
EL_DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel

# ── Kokoro voice defaults ────────────────────────────────────────────────────
DEFAULT_VOICE = "am_michael"
FEMALE_VOICE = "af_heart"
DEFAULT_DESCRIPTION = (
    "Realistic male voice in the 30s with american accent. "
    "Normal pitch, warm timbre, conversational pacing."
)

# ── Globals populated on startup ────────────────────────────────────────────
DEVICE = "cpu"
pipeline = None  # KPipeline instance, True (EL sentinel), or None
AUDIO_FILES: Dict[str, str] = {}  # id -> lore-{id}.mp3 path
FIRESTORE = None  # firestore client, set in init_firebase()


# ── Content-addressed IDs (must match mobile/lib/hash.ts exactly) ────────────
def _norm_email(email: str) -> str:
    return (email or "").lower().strip()


def newsletter_hash(sender_email: str) -> str:
    return hashlib.sha256(_norm_email(sender_email).encode()).hexdigest()


def episode_hash(sender_email: str, received_iso: str) -> str:
    """sha256("email:YYYY-MM-DD"). Date taken from the email's received timestamp (UTC)."""
    try:
        dt = datetime.fromisoformat(received_iso.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        dt = datetime.now(timezone.utc)
    date_str = dt.astimezone(timezone.utc).strftime("%Y-%m-%d")
    return hashlib.sha256(f"{_norm_email(sender_email)}:{date_str}".encode()).hexdigest()

app = FastAPI(title="Lore TTS sidecar (Kokoro)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def pick_device() -> str:
    if not _KOKORO_AVAILABLE:
        return "cpu"
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def init_firebase():
    if not _FIREBASE_AVAILABLE:
        print("[lore] firebase-admin not installed — Storage upload disabled", flush=True)
        return
    try:
        if not firebase_admin._apps:
            # Cloud Run: JSON content in env var
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if sa_json:
                cred = credentials.Certificate(json.loads(sa_json))
            elif os.path.exists(SERVICE_ACCOUNT_PATH):
                cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
            else:
                print(f"[lore] no Firebase credentials found — Storage upload disabled", flush=True)
                return
            firebase_admin.initialize_app(cred, {"storageBucket": STORAGE_BUCKET})
        global FIRESTORE
        FIRESTORE = fb_firestore.client()
        print("[lore] Firebase Admin initialised — Storage + Firestore globals enabled", flush=True)
    except Exception as e:
        print(f"[lore] Firebase Admin init failed: {e}", flush=True)


def upload_to_storage(local_path: str, audio_id: str) -> Optional[str]:
    """Upload MP3 to Firebase Storage and return a permanent Firebase download URL.

    Uses the firebaseStorageDownloadTokens metadata pattern so the URL works
    via the Firebase Storage REST API without requiring the bucket to be public
    or uniform access control to be disabled.
    """
    if not _FIREBASE_AVAILABLE or not firebase_admin._apps:
        return None
    try:
        download_token = str(uuid.uuid4())
        storage_path = f"audio/{audio_id}.mp3"

        bucket = fb_storage.bucket()
        blob = bucket.blob(storage_path)
        blob.metadata = {"firebaseStorageDownloadTokens": download_token}
        blob.upload_from_filename(local_path, content_type="audio/mpeg")
        blob.patch()  # persist the metadata

        encoded = urllib.parse.quote(storage_path, safe="")
        url = (
            f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}"
            f"/o/{encoded}?alt=media&token={download_token}"
        )
        print(f"[lore] uploaded to Storage: {url}", flush=True)
        return url
    except Exception as e:
        print(f"[lore] Storage upload FAILED for {audio_id}: {e}", flush=True)
        return None


@app.on_event("startup")
def load_models():
    global pipeline, DEVICE
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    # Rebuild in-memory map from previously generated files so audio_urls
    # stored in Firestore survive sidecar restarts.
    for fname in os.listdir(OUTPUT_DIR):
        if fname.startswith("lore-") and fname.endswith(".mp3"):
            audio_id = fname[len("lore-"):-len(".mp3")]
            AUDIO_FILES[audio_id] = os.path.join(OUTPUT_DIR, fname)
    print(f"[lore] restored {len(AUDIO_FILES)} cached audio files", flush=True)

    init_firebase()

    if ELEVENLABS_API_KEY:
        print(f"[lore] ElevenLabs mode — skipping Kokoro load (model={EL_MODEL})", flush=True)
        DEVICE = "elevenlabs"
        pipeline = True  # sentinel: "ready, but using EL not Kokoro"
        print(f"[lore] ready. backend=elevenlabs", flush=True)
        return

    if not _KOKORO_AVAILABLE:
        print("[lore] Kokoro not installed — ElevenLabs key required", flush=True)
        return
    DEVICE = pick_device()
    print(f"[lore] loading Kokoro-82M on device={DEVICE} ...", flush=True)
    try:
        pipeline = KPipeline(lang_code=LANG_CODE, device=DEVICE)
    except Exception as e:  # MPS can be flaky for some ops; fall back to CPU
        print(f"[lore] {DEVICE} init failed ({e}); falling back to CPU", flush=True)
        DEVICE = "cpu"
        pipeline = KPipeline(lang_code=LANG_CODE, device="cpu")
    print(f"[lore] ready. device={DEVICE}", flush=True)


def pick_voice(description: str | None, explicit: str | None) -> str:
    """Map a free-text voice description to the closest Kokoro voice.

    Priority order:
      1. explicit voice id (user selected from dropdown) — always wins
      2. keyword heuristic on description
      3. fallback to DEFAULT_VOICE
    """
    if explicit:
        return explicit

    d = (description or "").lower()

    # ── female voices ──────────────────────────────────────────────────────
    # af_nicole — soft, breathy, intimate narrator
    if any(w in d for w in ["soft", "breathy", "intimate", "whisper", "gentle narrator", "asmr"]):
        return "af_nicole"
    # af_sky — young, casual, energetic female
    if any(w in d for w in ["young woman", "college", "teen", "casual female", "playful"]):
        return "af_sky"
    # af_bella — bright, clear, upbeat female
    if any(w in d for w in ["bright", "upbeat", "energetic woman", "cheerful", "news anchor female"]):
        return "af_bella"
    # af_heart — warm, conversational female (default female)
    if any(w in d for w in ["female", "woman", " she ", "girl", "lady", "warm woman", "podcast host female"]):
        return "af_heart"

    # ── male voices ────────────────────────────────────────────────────────
    # am_onyx — deep, serious, authoritative
    if any(w in d for w in ["deep", "bass", "authoritative", "serious", "gravitas", "baritone", "documentary"]):
        return "am_onyx"
    # am_puck — bright, light, animated male
    if any(w in d for w in ["bright male", "animated", "light male", "enthusiastic", "energetic male"]):
        return "am_puck"
    # am_michael — warm conversational male (default)
    if any(w in d for w in ["male", "man", " he ", "guy", "podcast", "narrator", "conversational", "warm"]):
        return "am_michael"

    return DEFAULT_VOICE


def synthesize_audio_and_words(text: str, voice: str):
    """
    Run Kokoro over (possibly long) text. Returns (pcm, words) where words is a
    list of {start, end} in seconds, grouped from Kokoro's per-token timestamps
    (a word ends when a token has trailing whitespace). Kokoro emits one Result
    per chunk with chunk-relative timestamps, so we offset each chunk by the
    cumulative audio duration that came before it.
    """
    chunks: list[np.ndarray] = []
    words: list[dict] = []
    offset = 0.0  # seconds of audio emitted by previous chunks

    for r in pipeline(text, voice=voice):
        audio = getattr(r, "audio", None)
        if audio is None:
            continue
        arr = audio.detach().cpu().numpy() if torch.is_tensor(audio) else np.asarray(audio)
        arr = arr.astype(np.float32).reshape(-1)

        # group tokens -> words using this chunk's offset
        cur: dict | None = None
        for tk in (getattr(r, "tokens", None) or []):
            if tk.start_ts is None:
                continue
            s = float(tk.start_ts) + offset
            e = float(tk.end_ts if tk.end_ts is not None else tk.start_ts) + offset
            if cur is None:
                cur = {"start": s, "end": e}
            else:
                cur["end"] = e
            if tk.whitespace:  # space (or newline) after this token => word boundary
                words.append(cur)
                cur = None
        if cur is not None:
            words.append(cur)

        chunks.append(arr)
        offset += len(arr) / SAMPLE_RATE

    if not chunks:
        raise HTTPException(status_code=500, detail="Kokoro produced no audio")
    return np.concatenate(chunks), words


def pcm_to_mp3(pcm, path: str):
    """WAV in memory -> ffmpeg -> MP3 on disk."""
    wav_buf = io.BytesIO()
    sf.write(wav_buf, pcm, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    wav_buf.seek(0)
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", "pipe:0", "-codec:a", "libmp3lame", "-q:a", "2", path],
        input=wav_buf.read(),
        capture_output=True,
    )
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"ffmpeg failed: {proc.stderr.decode(errors='ignore')[:500]}",
        )


# ── Endpoints ───────────────────────────────────────────────────────────────
class SynthRequest(BaseModel):
    text: str
    description: str | None = None
    voice: str | None = None


@app.get("/health")
def health():
    backend = "elevenlabs" if ELEVENLABS_API_KEY else "kokoro"
    return {"status": "ok", "device": DEVICE, "backend": backend, "ready": pipeline is not None}


def _chars_to_words(characters: list, starts: list, ends: list) -> list:
    """Convert ElevenLabs character-level alignment into word-level [{start, end}]."""
    words = []
    word_start: float | None = None
    word_end: float = 0.0
    in_word = False

    for char, s, e in zip(characters, starts, ends):
        if char == " ":
            if in_word:
                words.append({"start": word_start, "end": word_end})
                in_word = False
                word_start = None
        else:
            if not in_word:
                word_start = s
                in_word = True
            word_end = e

    if in_word and word_start is not None:
        words.append({"start": word_start, "end": word_end})

    return words


def _generate_elevenlabs(text: str, kokoro_voice: str) -> dict:
    """Call ElevenLabs /with-timestamps, save MP3 directly (no ffmpeg needed),
    reconstruct word timestamps from character alignment."""
    el_voice_id = EL_VOICE_MAP.get(kokoro_voice, EL_DEFAULT_VOICE_ID)
    url = f"{EL_API_BASE}/text-to-speech/{el_voice_id}/with-timestamps"
    payload = json.dumps({
        "text": text,
        "model_id": EL_MODEL,
        "output_format": "mp3_44100_128",
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")[:400]
        raise HTTPException(status_code=502, detail=f"ElevenLabs {e.code}: {body}")
    gen_ms = int((time.perf_counter() - t0) * 1000)

    data = json.loads(raw)
    mp3_bytes = base64.b64decode(data["audio_base64"])
    alignment = data.get("alignment", {})
    words = _chars_to_words(
        alignment.get("characters", []),
        alignment.get("character_start_times_seconds", []),
        alignment.get("character_end_times_seconds", []),
    )

    audio_id = uuid.uuid4().hex
    path = os.path.join(OUTPUT_DIR, f"lore-{audio_id}.mp3")
    with open(path, "wb") as f:
        f.write(mp3_bytes)
    AUDIO_FILES[audio_id] = path

    # Estimate duration from last word timestamp; fall back to file size heuristic.
    audio_duration_s = round(words[-1]["end"], 2) if words else round(len(mp3_bytes) / 16000, 2)

    storage_url = upload_to_storage(path, audio_id)
    audio_url = storage_url if storage_url else f"/audio/{audio_id}"

    return {
        "id": audio_id,
        "audio_url": audio_url,
        "voice": kokoro_voice,
        "generation_time_ms": gen_ms,
        "audio_duration_s": audio_duration_s,
        "word_count": len(re.findall(r"\S+", text)),
        "words": [{"start": round(w["start"], 3), "end": round(w["end"], 3)} for w in words],
    }


def _generate(text: str, voice: str) -> dict:
    """Core TTS: text + voice -> stored MP3 + metadata. Shared by /synthesize
    and /episode. Routes to ElevenLabs when ELEVENLABS_API_KEY is set,
    otherwise uses local Kokoro."""
    if ELEVENLABS_API_KEY:
        return _generate_elevenlabs(text, voice)

    t0 = time.perf_counter()
    pcm, words = synthesize_audio_and_words(text, voice)
    gen_ms = int((time.perf_counter() - t0) * 1000)

    audio_id = uuid.uuid4().hex
    path = os.path.join(OUTPUT_DIR, f"lore-{audio_id}.mp3")
    pcm_to_mp3(pcm, path)
    AUDIO_FILES[audio_id] = path

    # Permanent Firebase Storage URL; fall back to local sidecar URL.
    storage_url = upload_to_storage(path, audio_id)
    audio_url = storage_url if storage_url else f"/audio/{audio_id}"

    return {
        "id": audio_id,
        "audio_url": audio_url,
        "voice": voice,
        "generation_time_ms": gen_ms,
        "audio_duration_s": round(len(pcm) / SAMPLE_RATE, 2),
        "word_count": len(re.findall(r"\S+", text)),
        "words": [{"start": round(w["start"], 3), "end": round(w["end"], 3)} for w in words],
    }


@app.post("/synthesize")
def synthesize(req: SynthRequest):
    if not pipeline:
        raise HTTPException(status_code=503, detail="Model still loading")
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    voice = pick_voice(req.description or DEFAULT_DESCRIPTION, req.voice)
    return JSONResponse(_generate(text, voice))


# ── Shared Audio Nodes: global dedup + generate ──────────────────────────────
class EpisodeRequest(BaseModel):
    uid: str
    sender_email: str
    sender_name: str
    sender_logo_url: str | None = None
    frequency: str | None = None
    subject: str
    text: str
    received_at: str            # ISO timestamp of when the email arrived
    description: str | None = None
    voice: str | None = None


def _require_firestore():
    if FIRESTORE is None:
        raise HTTPException(status_code=503, detail="Firestore Admin not configured on sidecar")


def _upsert_newsletter(nl_hash: str, req: EpisodeRequest, *, new_episode: bool, received_at: str):
    """Create/refresh the global newsletter node. Never touches follower_count
    (that's owned by /follow)."""
    ref = FIRESTORE.collection("global_newsletters").document(nl_hash)
    snap = ref.get()
    if snap.exists:
        update = {"last_episode_at": received_at}
        if new_episode:
            update["episode_count"] = fb_firestore.Increment(1)
        ref.update(update)
    else:
        ref.set({
            "sender_hash": nl_hash,
            "sender_name": req.sender_name,
            "sender_email": _norm_email(req.sender_email),
            "logo_url": req.sender_logo_url,
            "frequency": req.frequency,
            "follower_count": 0,
            "episode_count": 1 if new_episode else 0,
            "last_episode_at": received_at,
            "added_by_uid": req.uid,
            "created_at": fb_firestore.SERVER_TIMESTAMP,
        })


@app.post("/episode")
def episode(req: EpisodeRequest):
    """Generate-or-reuse one global episode (Shared Audio Node). If the episode
    already exists, skip TTS entirely and return the existing audio. All global
    collection writes happen here via the Admin SDK — clients never write them."""
    _require_firestore()
    if not pipeline:
        raise HTTPException(status_code=503, detail="Model still loading")
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")

    nl_hash = newsletter_hash(req.sender_email)
    ep_hash = episode_hash(req.sender_email, req.received_at)
    ep_ref = FIRESTORE.collection("global_episodes").document(ep_hash)

    existing = ep_ref.get()
    if existing.exists:
        # Shared Audio Node hit — zero TTS cost.
        data = existing.to_dict()
        _upsert_newsletter(nl_hash, req, new_episode=False, received_at=req.received_at)
        print(f"[lore] episode REUSE {ep_hash[:8]} ({req.sender_name})", flush=True)
        return JSONResponse({
            "reused": True,
            "episode_hash": ep_hash,
            "newsletter_id": nl_hash,
            "subject": data.get("subject"),
            "audio_url": data.get("audio_url"),
            "audio_duration_s": data.get("audio_duration_s"),
            "received_at": data.get("received_at"),
        })

    # Miss — generate once, store globally.
    voice = pick_voice(req.description or DEFAULT_DESCRIPTION, req.voice)
    gen = _generate(text, voice)
    ep_ref.set({
        "episode_hash": ep_hash,
        "newsletter_id": nl_hash,
        "subject": req.subject,
        "tts_script": text,
        "audio_url": gen["audio_url"],
        "audio_duration_s": gen["audio_duration_s"],
        "generation_time_ms": gen["generation_time_ms"],
        "play_count": 0,
        "received_at": req.received_at,
        "created_at": fb_firestore.SERVER_TIMESTAMP,
    })
    _upsert_newsletter(nl_hash, req, new_episode=True, received_at=req.received_at)
    print(f"[lore] episode NEW {ep_hash[:8]} ({req.sender_name}) gen={gen['generation_time_ms']}ms", flush=True)
    return JSONResponse({
        "reused": False,
        "episode_hash": ep_hash,
        "newsletter_id": nl_hash,
        "subject": req.subject,
        "audio_url": gen["audio_url"],
        "audio_duration_s": gen["audio_duration_s"],
        "received_at": req.received_at,
        # Only present on first generation — too large to store inline in
        # global_episodes (~100KB/2500-word episode); not returned on reuse.
        "word_count": gen["word_count"],
        "words": gen["words"],
        "generation_time_ms": gen["generation_time_ms"],
    })


class FollowRequest(BaseModel):
    uid: str
    newsletter_id: str   # nl_hash
    delta: int = 1       # +1 follow, -1 unfollow


@app.post("/follow")
def follow(req: FollowRequest):
    """Adjust a newsletter's global follower_count (Admin-only write) and return
    its recent episode_hashes so the client can populate its own feed."""
    _require_firestore()
    ref = FIRESTORE.collection("global_newsletters").document(req.newsletter_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Newsletter not in catalog")
    delta = 1 if req.delta >= 0 else -1
    ref.update({"follower_count": fb_firestore.Increment(delta)})

    eps = (
        FIRESTORE.collection("global_episodes")
        .where("newsletter_id", "==", req.newsletter_id)
        .order_by("received_at", direction=fb_firestore.Query.DESCENDING)
        .limit(20)
        .stream()
    )
    episode_hashes = [e.id for e in eps]
    return JSONResponse({"newsletter_id": req.newsletter_id, "episode_hashes": episode_hashes})


class PlayRequest(BaseModel):
    episode_hash: str


@app.post("/play")
def play(req: PlayRequest):
    """Increment a global episode's play_count (Admin-only write)."""
    _require_firestore()
    FIRESTORE.collection("global_episodes").document(req.episode_hash).update(
        {"play_count": fb_firestore.Increment(1)}
    )
    return JSONResponse({"ok": True})


# ── Google OAuth: one-time exchange + silent refresh ─────────────────────────
def _google_token_call(form: Dict[str, str]) -> dict:
    body = urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")[:300]
        raise HTTPException(status_code=e.code, detail=f"Google token endpoint: {detail}")


class ExchangeRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str | None = None


@app.post("/auth/google/exchange")
def google_exchange(req: ExchangeRequest):
    """Exchange an auth code for tokens; store the refresh token server-side."""
    if not GOOGLE_OAUTH_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="GOOGLE_OAUTH_CLIENT_SECRET not configured")
    form = {
        "code": req.code,
        "client_id": GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
        "redirect_uri": req.redirect_uri,
        "grant_type": "authorization_code",
    }
    if req.code_verifier:
        form["code_verifier"] = req.code_verifier
    tokens = _google_token_call(form)
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="No access_token from Google")

    # Identify the user with the fresh token (sub is the stable Google id).
    ureq = urllib.request.Request(
        GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
    )
    with urllib.request.urlopen(ureq, timeout=30) as resp:
        info = json.loads(resp.read())

    refresh_token = tokens.get("refresh_token")
    if refresh_token and FIRESTORE is not None:
        FIRESTORE.collection("gmail_tokens").document(info["sub"]).set({
            "refresh_token": refresh_token,
            "email": info.get("email"),
            "updated_at": fb_firestore.SERVER_TIMESTAMP,
        })
        print(f"[lore] stored refresh token for {info.get('email')}", flush=True)

    return JSONResponse({
        "access_token": access_token,
        "expires_in": tokens.get("expires_in", 3600),
        "id_token": tokens.get("id_token"),
        "has_refresh": bool(refresh_token),
        "user": {
            "sub": info["sub"],
            "email": info.get("email"),
            "name": info.get("name") or info.get("email"),
            "picture": info.get("picture"),
        },
    })


class SilentTokenRequest(BaseModel):
    uid: str


@app.post("/auth/google/token")
def google_silent_token(req: SilentTokenRequest):
    """Mint a fresh access token from the stored refresh token — no user prompt."""
    if not GOOGLE_OAUTH_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="GOOGLE_OAUTH_CLIENT_SECRET not configured")
    _require_firestore()
    snap = FIRESTORE.collection("gmail_tokens").document(req.uid).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="No refresh token on file")
    refresh_token = (snap.to_dict() or {}).get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=404, detail="No refresh token on file")
    try:
        tokens = _google_token_call({
            "client_id": GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        })
    except HTTPException as e:
        # invalid_grant → user revoked access; clear so the client re-consents.
        if e.status_code == 400:
            FIRESTORE.collection("gmail_tokens").document(req.uid).delete()
            raise HTTPException(status_code=401, detail="Refresh token revoked — reconnect Gmail")
        raise
    return JSONResponse({
        "access_token": tokens.get("access_token"),
        "expires_in": tokens.get("expires_in", 3600),
    })


def _range_response(path: str, range_header: str | None) -> Response:
    size = os.path.getsize(path)
    headers = {"Accept-Ranges": "bytes", "Content-Type": "audio/mpeg"}

    if not range_header:
        with open(path, "rb") as f:
            data = f.read()
        headers["Content-Length"] = str(size)
        return Response(content=data, headers=headers, media_type="audio/mpeg")

    m = re.match(r"bytes=(\d*)-(\d*)", range_header)
    start = int(m.group(1)) if m and m.group(1) else 0
    end = int(m.group(2)) if m and m.group(2) else size - 1
    end = min(end, size - 1)
    length = end - start + 1

    with open(path, "rb") as f:
        f.seek(start)
        data = f.read(length)
    headers.update({
        "Content-Range": f"bytes {start}-{end}/{size}",
        "Content-Length": str(length),
    })
    return Response(content=data, status_code=206, headers=headers, media_type="audio/mpeg")


@app.get("/audio/{audio_id}")
def get_audio(audio_id: str, request: Request):
    path = AUDIO_FILES.get(audio_id)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return _range_response(path, request.headers.get("range"))
