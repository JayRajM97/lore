// Tiny localStorage-backed UI preferences (web; silently no-ops on native
// until we swap in AsyncStorage). Used for view modes and player theme.

function storage(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; }
  catch { return null; }
}

export function getPref(key: string, fallback: string): string {
  try { return storage()?.getItem(`lore_pref_${key}`) ?? fallback; }
  catch { return fallback; }
}

export function setPref(key: string, value: string) {
  try { storage()?.setItem(`lore_pref_${key}`, value); } catch {}
}
