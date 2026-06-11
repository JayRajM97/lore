"""Recover dead episodes: re-synthesize from stored raw_text via the running
sidecar (which now uploads to Firebase Storage), then relink audio_url in
Firestore. Run once with the sidecar live on :8000.

  python recover_audio.py
"""
import os
import requests

import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT = os.path.expanduser("~/.lore/firebase-service-account.json")
SIDECAR = "http://localhost:8000/synthesize"

cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred, {"storageBucket": "lore-10132.firebasestorage.app"})
db = firestore.client()

dead = []
for doc in db.collection_group("episodes").stream():
    d = doc.to_dict()
    url = d.get("audio_url", "")
    if "localhost" in url or "127.0.0.1" in url:
        dead.append((doc.reference, d))

print(f"{len(dead)} dead episodes to recover.\n")

ok = fail = 0
for i, (ref, d) in enumerate(dead, 1):
    text = (d.get("raw_text") or "").strip()
    name = ref.path.split("/")[-1]
    if len(text) < 50:
        print(f"[{i}/{len(dead)}] SKIP {name} — no raw_text")
        fail += 1
        continue
    try:
        r = requests.post(SIDECAR, json={"text": text}, timeout=300)
        r.raise_for_status()
        res = r.json()
        ref.update({
            "audio_url": res["audio_url"],
            "audio_duration_s": res.get("audio_duration_s", d.get("audio_duration_s")),
            "word_count": res.get("word_count", d.get("word_count")),
        })
        ok += 1
        print(f"[{i}/{len(dead)}] OK   {name} -> {res['audio_url'][:80]}...")
    except Exception as e:
        fail += 1
        print(f"[{i}/{len(dead)}] FAIL {name} — {e}")

print(f"\nDone. recovered={ok} failed={fail}")
