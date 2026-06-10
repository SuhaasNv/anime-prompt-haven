// Simple in-memory fixed-window rate limiter.
//
// State lives in process memory only: it resets on restart/redeploy and
// isn't shared across instances. That's an accepted tradeoff for this app's
// traffic profile — it stops casual brute-force/credential-stuffing without
// adding a database table or IP-extraction logic.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateLimitEntry>();

function cleanup(now: number): void {
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key);
  }
}

/**
 * Throws if `key` has exceeded `maxAttempts` within `windowMs`.
 * Otherwise records this attempt.
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): void {
  const now = Date.now();
  cleanup(now);

  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (entry.count >= maxAttempts) {
    throw new Error("Too many attempts. Please try again later.");
  }

  entry.count += 1;
}
