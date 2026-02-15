const BLOCKED_PATTERNS = [
  /document\.cookie/i,
  /document\.domain/i,
  /window\.opener/i,
  /\bfetch\s*\(/i,
  /XMLHttpRequest/i,
  /navigator\.sendBeacon/i,
  /\blocalStorage\b/i,
  /\bsessionStorage\b/i,
  /\bindexedDB\b/i,
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /window\.open\s*\(/i,
  /window\.location\s*[.=]/i,
  /\.postMessage\s*\(/i,
  /\bimport\s*\(/i,
  /document\.write/i,
  /\.innerHTML\s*=/i,
  /\.outerHTML\s*=/i,
];

export function isScriptSafe(code: string): boolean {
  return !BLOCKED_PATTERNS.some((p) => p.test(code));
}
