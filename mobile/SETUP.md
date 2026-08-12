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

If you are testing on iOS simulator, the app can talk to a backend running on your Mac
via `http://localhost:8000`.

If you are testing on a physical device, point the backend to your Mac's local LAN IP:

```bash
EXPO_PUBLIC_BACKEND_URL=http://192.168.<your-ip>:8000 npx expo run:ios
```

(If you only want to demo the UI without real auth, Expo Go still works — but tapping
"Connect Gmail" won't complete.)

## iOS dev build checklist

1. Install Xcode and the Xcode command-line tools.
2. Install Node.js / npm on your Mac so `npx` works.
3. In `/Users/jay/Documents/jay-claude/lore/mobile`, run:

```bash
npm install
```

4. Make sure `mobile/app.json` contains the iOS bundle ID and URL scheme:
   - `bundleIdentifier`: `com.lore.app`
   - `CFBundleURLSchemes`: `com.googleusercontent.apps.331040043777-ef75f5ot1po0029u1kjv3gao23khmv8j`

5. (Optional but recommended) If you are using Firebase native features, place the
   downloaded `GoogleService-Info.plist` from Firebase into `mobile/`.
6. Run the development build:

```bash
cd mobile
npx expo run:ios
```

7. If your backend is local and you want the mobile app to call it, run the sidecar on your
   Mac and use the simulator URL or LAN IP as described above.

8. In Google Cloud Console, confirm the iOS OAuth client is configured for:
   - package/bundle ID `com.lore.app`
   - reversed client ID `com.googleusercontent.apps.331040043777-ef75f5ot1po0029u1kjv3gao23khmv8j`

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
