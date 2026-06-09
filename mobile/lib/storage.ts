import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Fetch audio bytes from the (ephemeral) sidecar URL and upload to Firebase
 * Storage. Returns a permanent download URL that survives sidecar restarts.
 */
export async function uploadAudio(
  userId: string,
  episodeId: string,
  sidecarUrl: string
): Promise<string> {
  const res = await fetch(sidecarUrl);
  if (!res.ok) throw new Error(`audio fetch ${res.status}`);
  const blob = await res.blob();
  const r = ref(storage, `episodes/${userId}/${episodeId}.mp3`);
  await uploadBytes(r, blob, { contentType: "audio/mpeg" });
  return getDownloadURL(r);
}
