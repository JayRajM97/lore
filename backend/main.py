"""
Lore backend — single FastAPI server that handles:
  1. TTS synthesis (Kokoro-82M, same as the sidecar)
  2. Gmail OAuth token exchange + inbox scanning
  3. Newsletter detection heuristics
  4. Firebase Firestore writes (episodes, users, follows)
  5. Firebase Storage uploads (audio MP3s)

Runs on Render.com free tier (or locally for dev).
Set environment variables in Render dashboard or a local .env file.
"""

import io
import os
import re
import time
import uuid
import subprocess
from typing import Optional

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

# ── env vars (set in Render dashboard, never hardcoded) ─────────────────────
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")          # web OAuth client
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")  # web OAuth secret
FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")

# ── Firebase Admin (server-side writes to Firestore + Storage) ───────────────
import firebase_admin
from firebase_admin import credentials, firestore, storage as fb_storage
import json as _json

if FIREBASE_SERVICE_ACCOUNT and not firebase_admin._apps:
    _cred = credentials.Certificate(_json.loads(FIREBASE_SERVICE_ACCOUNT))
    firebase_admin.initialize_app(_cred, {
        "storageBucket": "lore-10132.firebasestorage.app"
    })
    _db = firestore.client()
    _bucket = fb_storage.bucket()
else:
    _db = None
    _bucket = None

# ── TTS globals ──────────────────────────────────────────────────────────────
SAMPLE_RATE = 24000
DEFAULT_VOICE = "af_heart"
_pipeline = None
_device = "cpu"

app = FastAPI(title="Lore backend")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    global _pipeline, _device
    _device = "mps" if torch.backends.mps.is_available() else (
        "cuda" if torch.cuda.is_available() else "cpu"
    )
    print(f"[lore] loading Kokoro on device={_device} ...", flush=True)
    try:
        from kokoro import KPipeline
        _pipeline = KPipeline(lang_code="a", device=_device)
    except Exception as e:
        print(f"[lore] Kokoro load failed ({e}); falling back to CPU", flush=True)
        from kokoro import KPipeline
        _pipeline = KPipeline(lang_code="a", device="cpu")
        _device = "cpu"
    print(f"[lore] ready. device={_device}", flush=True)


# ── Helpers ──────────────────────────────────────────────────────────────────
def pick_voice(description: Optional[str], explicit: Optional[str]) -> str:
    if explicit: return explicit
    d = (description or "").lower()
    return "af_heart" if any(w in d for w in ["female", "woman", "girl", "she"]) else "am_michael"


def synthesize_audio_and_words(text: str, voice: str):
    chunks, words, offset = [], [], 0.0
    for r in _pipeline(text, voice=voice):
        audio = getattr(r, "audio", None)
        if audio is None: continue
        arr = (audio.detach().cpu().numpy() if torch.is_tensor(audio) else np.asarray(audio)).astype(np.float32).reshape(-1)
        cur = None
        for tk in (getattr(r, "tokens", None) or []):
            if tk.start_ts is None: continue
            s, e = float(tk.start_ts) + offset, float(tk.end_ts or tk.start_ts) + offset
            cur = {"start": s, "end": e} if cur is None else {**cur, "end": e}
            if tk.whitespace:
                words.append(cur); cur = None
        if cur: words.append(cur)
        chunks.append(arr)
        offset += len(arr) / SAMPLE_RATE
    if not chunks:
        raise HTTPException(500, "Kokoro produced no audio")
    return np.concatenate(chunks), words


def pcm_to_mp3_bytes(pcm: np.ndarray) -> bytes:
    wav_buf = io.BytesIO()
    sf.write(wav_buf, pcm, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    wav_buf.seek(0)
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", "pipe:0", "-codec:a", "libmp3lame", "-q:a", "2", "pipe:1"],
        input=wav_buf.read(), capture_output=True
    )
    if proc.returncode != 0:
        raise HTTPException(500, f"ffmpeg: {proc.stderr.decode()[:300]}")
    return proc.stdout


def upload_audio(mp3_bytes: bytes, episode_id: str) -> str:
    """Upload MP3 to Firebase Storage, return public URL."""
    if not _bucket:
        raise HTTPException(503, "Storage not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing)")
    blob = _bucket.blob(f"episodes/{episode_id}.mp3")
    blob.upload_from_string(mp3_bytes, content_type="audio/mpeg")
    blob.make_public()
    return blob.public_url


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "device": _device, "ready": _pipeline is not None}


# ── TTS synthesis (used by mobile + web) ────────────────────────────────────
class SynthRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    description: Optional[str] = None
    episode_id: Optional[str] = None   # if set, upload to Firebase Storage

@app.post("/synthesize")
def synthesize(req: SynthRequest):
    if not _pipeline:
        raise HTTPException(503, "Model still loading")
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "Empty text")
    voice = pick_voice(req.description, req.voice)

    t0 = time.perf_counter()
    pcm, words = synthesize_audio_and_words(text, voice)
    gen_ms = int((time.perf_counter() - t0) * 1000)
    mp3 = pcm_to_mp3_bytes(pcm)

    ep_id = req.episode_id or uuid.uuid4().hex

    # If Firebase is configured, upload and return a permanent URL.
    # Otherwise save to /tmp and serve via /audio/{id} (local dev).
    if _bucket and req.episode_id:
        audio_url = upload_audio(mp3, ep_id)
    else:
        path = f"/tmp/lore-{ep_id}.mp3"
        with open(path, "wb") as f: f.write(mp3)
        _local_audio[ep_id] = path
        audio_url = f"/audio/{ep_id}"

    return JSONResponse({
        "id": ep_id,
        "audio_url": audio_url,
        "voice": voice,
        "generation_time_ms": gen_ms,
        "audio_duration_s": round(len(pcm) / SAMPLE_RATE, 2),
        "word_count": len(re.findall(r"\S+", text)),
        "words": [{"start": round(w["start"], 3), "end": round(w["end"], 3)} for w in words],
    })


# local audio map for dev (no Firebase Storage)
_local_audio: dict[str, str] = {}

@app.get("/audio/{audio_id}")
def get_audio(audio_id: str):
    path = _local_audio.get(audio_id)
    if not path or not os.path.exists(path):
        raise HTTPException(404, "Not found")
    with open(path, "rb") as f: data = f.read()
    return Response(content=data, media_type="audio/mpeg", headers={"Accept-Ranges": "bytes"})


# ── Gmail OAuth token exchange ────────────────────────────────────────────────
class GoogleTokenRequest(BaseModel):
    code: str
    redirect_uri: str

@app.post("/auth/google")
async def auth_google(req: GoogleTokenRequest):
    """
    Exchange the OAuth code from the mobile app for tokens.
    Stores refresh_token in Firestore under users/{google_user_id}.
    Returns { user_id, access_token } to the mobile app.
    """
    from google.oauth2 import id_token as google_id_token
    from google_auth_oauthlib.flow import Flow
    import google.auth.transport.requests as grequests

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "GOOGLE_CLIENT_ID/SECRET not configured")

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=[
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.readonly",
        ],
        redirect_uri=req.redirect_uri,
    )
    flow.fetch_token(code=req.code)
    credentials_obj = flow.credentials

    # Verify ID token to get stable Google user ID.
    request = grequests.Request()
    id_info = google_id_token.verify_oauth2_token(
        credentials_obj.id_token, request, GOOGLE_CLIENT_ID
    )
    user_id = id_info["sub"]
    email = id_info.get("email", "")
    name = id_info.get("name", "")

    # Persist tokens in Firestore.
    if _db:
        _db.collection("users").document(user_id).set({
            "email": email,
            "name": name,
            "gmail_access_token": credentials_obj.token,
            "gmail_refresh_token": credentials_obj.refresh_token,
            "token_expiry": credentials_obj.expiry.isoformat() if credentials_obj.expiry else None,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    return {"user_id": user_id, "access_token": credentials_obj.token, "email": email, "name": name}


# ── Gmail inbox scan ─────────────────────────────────────────────────────────
NEWSLETTER_DOMAINS = {
    "substack.com", "beehiiv.com", "convertkit.com", "mailchimp.com",
    "sendgrid.net", "klaviyo.com", "constantcontact.com", "ghost.io",
}
SUBJECT_PATTERNS = re.compile(r"\bvol\b|\bissue\s*#|\b#\d+\b|weekly|daily|3-2-1|digest", re.I)
FREQ_DAYS = {"Daily": 1, "Weekly": 7, "Monthly": 30}

def detect_frequency(gap_days: float) -> str:
    if gap_days <= 2: return "Daily"
    if gap_days <= 10: return "Weekly"
    return "Monthly"


class ScanRequest(BaseModel):
    user_id: str
    access_token: str

@app.post("/gmail/scan")
async def gmail_scan(req: ScanRequest):
    """
    Scan last 30 days of Gmail for newsletters.
    Returns grouped newsletters; does NOT follow or store yet.
    """
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials

    creds = Credentials(token=req.access_token)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    # Fetch message IDs from last 30 days.
    result = service.users().messages().list(
        userId="me", q="newer_than:30d", maxResults=200
    ).execute()
    msg_ids = [m["id"] for m in result.get("messages", [])]

    # Group by sender, detect newsletters.
    from collections import defaultdict
    senders: dict[str, list] = defaultdict(list)

    for mid in msg_ids[:200]:  # cap for free tier
        try:
            msg = service.users().messages().get(
                userId="me", id=mid, format="metadata",
                metadataHeaders=["From", "Subject", "Date", "List-Unsubscribe"]
            ).execute()
        except Exception:
            continue

        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        from_raw = headers.get("From", "")
        subject = headers.get("Subject", "")
        date_str = headers.get("Date", "")
        has_unsub = bool(headers.get("List-Unsubscribe"))

        # Extract email address.
        m = re.search(r"<([^>]+)>", from_raw)
        sender_email = m.group(1).lower() if m else from_raw.lower().strip()
        sender_name = re.sub(r"\s*<[^>]+>", "", from_raw).strip().strip('"')
        domain = sender_email.split("@")[-1] if "@" in sender_email else ""

        # Newsletter scoring.
        score = 0
        if has_unsub: score += 3
        if domain in NEWSLETTER_DOMAINS: score += 3
        if SUBJECT_PATTERNS.search(subject): score += 2

        if score >= 3:
            senders[sender_email].append({
                "name": sender_name, "subject": subject,
                "date": date_str, "domain": domain
            })

    newsletters = []
    for email, msgs in senders.items():
        if len(msgs) < 1: continue
        freq = detect_frequency(30 / max(len(msgs), 1))
        newsletters.append({
            "id": uuid.uuid4().hex,
            "sender_email": email,
            "sender_name": msgs[0]["name"],
            "sender_logo_url": None,
            "frequency": freq,
            "last_received_at": msgs[0]["date"],
            "episode_count": len(msgs),
        })

    return {"newsletters": newsletters}
