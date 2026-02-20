const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

/**
 * Verify a Cloudflare Turnstile CAPTCHA token server-side.
 * Returns true if the token is valid, false otherwise.
 * If no secret key is configured, always returns true (dev mode).
 */
export async function verifyCaptcha(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    // No secret configured — skip verification (dev mode)
    return true;
  }

  if (!token) return false;

  try {
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
