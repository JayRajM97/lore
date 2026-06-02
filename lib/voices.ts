// Real Kokoro (American English) voices exposed in the UI dropdown.
//
// NOTE: Kokoro cannot clone specific real people (e.g. Obama, Scarlett
// Johansson) — those need a voice-cloning model and raise consent/likeness
// issues, so they are intentionally not offered. Indian-English isn't in
// Kokoro's American pipeline either. These are the genuine options.
export interface Voice {
  id: string;
  label: string;
}

export const VOICES: Voice[] = [
  { id: "af_heart", label: "American woman — warm, 30s" },
  { id: "af_bella", label: "American woman — bright" },
  { id: "af_sky", label: "Younger woman" },
  { id: "af_nicole", label: "American woman — soft" },
  { id: "am_michael", label: "American man — 30s" },
  { id: "am_onyx", label: "American man — deep" },
  { id: "am_puck", label: "American man — bright" },
];

export const DEFAULT_VOICE = "af_heart";
