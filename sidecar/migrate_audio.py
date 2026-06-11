"""One-shot migration: push local ~/.lore/audio/*.mp3 to Firebase Storage and
rewrite any Firestore episode whose audio_url still points at localhost.

Run once:  python migrate_audio.py
"""
import os
import uuid
import urllib.parse

import firebase_admin
from firebase_admin import credentials, storage, firestore

SERVICE_ACCOUNT = os.path.expanduser("~/.lore/firebase-service-account.json")
AUDIO_DIR = os.path.expanduser("~/.lore/audio")
STORAGE_BUCKET = "lore-10132.firebasestorage.app"

cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred, {"storageBucket": STORAGE_BUCKET})
bucket = storage.bucket()
db = firestore.client()


def upload(audio_id: str, local_path: str) -> str:
    token = str(uuid.uuid4())
    storage_path = f"audio/{audio_id}.mp3"
    blob = bucket.blob(storage_path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_filename(local_path, content_type="audio/mpeg")
    blob.patch()
    encoded = urllib.parse.quote(storage_path, safe="")
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}"
        f"/o/{encoded}?alt=media&token={token}"
    )


# 1. Upload every local file, build audio_id -> new URL map.
id_to_url: dict[str, str] = {}
for fname in os.listdir(AUDIO_DIR):
    if not (fname.startswith("lore-") and fname.endswith(".mp3")):
        continue
    audio_id = fname[len("lore-"):-len(".mp3")]
    url = upload(audio_id, os.path.join(AUDIO_DIR, fname))
    id_to_url[audio_id] = url
    print(f"uploaded {audio_id} -> {url}")

print(f"\n{len(id_to_url)} files uploaded.\n")

# 2. Rewrite Firestore episodes that still point at localhost.
updated = 0
for doc in db.collection_group("episodes").stream():
    data = doc.to_dict()
    url = data.get("audio_url", "")
    if "localhost" not in url and "127.0.0.1" not in url:
        continue
    # localhost URL form: http://localhost:8000/audio/{audio_id}
    audio_id = url.rstrip("/").split("/")[-1]
    new_url = id_to_url.get(audio_id)
    if not new_url:
        print(f"  SKIP {doc.reference.path} — no local file for {audio_id}")
        continue
    doc.reference.update({"audio_url": new_url})
    updated += 1
    print(f"  rewrote {doc.reference.path}")

print(f"\nDone. {updated} Firestore episodes rewritten to Storage URLs.")
