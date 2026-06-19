// Stable content-addressed IDs shared by client and sidecar.
//
// NOTE: spec called for md5 via Node's `crypto`, but React Native has no Node
// crypto and expo-crypto only does SHA. We use SHA-256 instead — it's only an
// identifier, not a security boundary. The sidecar mirrors this with
// hashlib.sha256 over the SAME canonical strings, so hashes match across both.
import * as Crypto from "expo-crypto";

async function sha256(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

/** Global newsletter id = sha256(normalized sender email). */
export async function newsletterHash(senderEmail: string): Promise<string> {
  return sha256(senderEmail.toLowerCase().trim());
}

/** Global episode id = sha256("email:YYYY-MM-DD"). One episode per sender per day. */
export async function episodeHash(senderEmail: string, receivedDate: Date): Promise<string> {
  const dateStr = receivedDate.toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
  return sha256(`${senderEmail.toLowerCase().trim()}:${dateStr}`);
}
