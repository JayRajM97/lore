# Lore mobile — real auth setup & run

## What's real now (this build)

- **Google Sign-In** (`expo-auth-session`) — real Google consent, Gmail read-only scope
- **Gmail inbox scan** — reads your last 30 days, detects newsletters on-device (`lib/gmail.ts`)
- **Newsletter discovery** — shows YOUR actual detected newsletters
- **Follow persistence** — selected newsletters saved to **Firebase Firestore** (`lib/db.ts`)

## What's still mock (next build)

- Home feed / episodes / player audio — episode generation pipeline (fetch newsletter
  body → preprocess → TTS → store) is not wired yet. Feed shows sample data.

---

## ⚠️ Google OAuth needs a DEV BUILD, not Expo Go

Expo Go can't honor the iOS redirect URI Google requires, so **sign-in will fail in Expo Go**.
Run a development build instead:

```bash
cd mobile
npx expo run:ios        # needs Xcode installed; builds + installs on simulator/device
```

First run compiles native code (~5 min). After that it's the same fast Metro reload.
The dev build reads `GoogleService-Info.plist` and the `CFBundleURLTypes` scheme from `app.json`.

(If you only want to demo the UI without real auth, Expo Go still works — but tapping
"Connect Gmail" won't complete.)

---

## 🔒 SECURITY — before sharing with anyone

Firestore is in **test mode** right now = anyone with the API key can read/write everything.
Fine for your own testing, NOT for 10–20 people. Lock it down in Firebase Console →
Firestore → Rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // A user can only touch their own data.
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

NOTE: those rules require **Firebase Auth** (signing the user into Firebase, not just Google).
We're currently using the Google token only for Gmail — wiring Firebase Auth is a small
follow-up. Until then, keep the test-mode window short and don't share the API key publicly.

The web Client Secret (`GOCSPX-…`) lives only in `backend/.env` (gitignored). If it ever
leaks, rotate it in Google Cloud Console → Credentials.

---

## TTS backend

`backend/main.py` = FastAPI (Kokoro TTS + optional Gmail/Firestore admin). For local dev the
mobile app hits `BACKEND_URL` in `mobile/lib/config.ts` (set to your Mac's LAN IP). Deploy to
Render.com later for a public URL.
