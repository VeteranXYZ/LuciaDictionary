const INVALID_PHONETIC_RE = /[\u0000-\u001f\u007f\ufffd\u25a0-\u25a3\u25a6\u25a7\u25ab-\u25ad\u25af\u2b1a]/;

export function cleanPhonetic(ph) {
  const raw = String(ph || "").trim();
  if (!raw) return "";
  if (INVALID_PHONETIC_RE.test(raw)) return "";
  const normalized = raw
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
  if (!normalized || INVALID_PHONETIC_RE.test(normalized)) return "";
  if (!/[a-zA-Zɑæəɜɪʊɔʌɒθðʃʒŋˈˌːˑ]/.test(normalized)) return "";
  return normalized;
}
