// La police standard du PDF (Helvetica) ne connaît que le jeu de caractères
// Windows-1252 : les autres caractères (espace fine insécable que l'IA met
// avant « ! ? : », flèches, émojis...) s'affichaient sous forme de signes
// parasites (« / », « H », « ’ »). On les remplace par un équivalent
// lisible, et on retire ceux qui n'en ont pas.

const REPLACEMENTS: [RegExp, string][] = [
  [/[          ]/g, " "],
  [/[​‌‍⁠﻿️]/g, ""],
  [/[‐‑‒−]/g, "-"],
  [/[→⇒➜➡]/g, "->"],
  [/[←⇐]/g, "<-"],
  [/≈/g, "~"],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/≠/g, "!="],
  [/[✓✔✅☑]/g, ""],
  [/[❌✗✘]/g, ""],
  [/[‐]/g, "-"],
  [/[″]/g, '"'],
  [/[′]/g, "'"],
];

// Caractères Windows-1252 hors Latin-1 (0x80-0x9F).
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

function isSupported(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  if (ch === "\n" || ch === "\t") return true;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return true;
  return CP1252_EXTRA.has(ch);
}

export function toPdfText(text: string): string {
  let out = text.normalize("NFC");
  for (const [re, replacement] of REPLACEMENTS) out = out.replace(re, replacement);
  out = Array.from(out)
    .filter(isSupported)
    .join("");
  return out.replace(/[  ]{2,}/g, " ").replace(/ +\n/g, "\n");
}
