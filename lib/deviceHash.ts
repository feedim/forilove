export function generateDeviceHash(): string {
  const raw = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");
  return simpleHash(raw);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function getDeviceHash(): string {
  const key = "fdm_device_hash";
  let hash = localStorage.getItem(key);
  if (!hash) {
    hash = generateDeviceHash();
    localStorage.setItem(key, hash);
  }
  return hash;
}
