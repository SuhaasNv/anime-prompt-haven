import OpenAI from "openai";
import Bottleneck from "bottleneck";
import { getServerConfig } from "./config.server";

// Lazy-initialized singleton OpenAI client
let openaiClient: OpenAI | undefined;

// Rate limiter for LLM API calls: aggressive limits since calls cost money
// Default: 5 calls per 3600 seconds (1 hour) per user
const DEFAULT_WINDOW_MS = 3600 * 1000; // 1 hour
const DEFAULT_MAX_ATTEMPTS = 5;

// Per-user rate limiters stored in memory
const userLimiters = new Map<string, Bottleneck>();

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const config = getServerConfig();
    if (!config.openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. Set it in your .env file."
      );
    }
    openaiClient = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }
  return openaiClient;
}

export function createUserRateLimiter(
  userId: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  windowMs: number = DEFAULT_WINDOW_MS
): Bottleneck {
  const key = `llm-${userId}`;
  if (!userLimiters.has(key)) {
    // Fixed-window rate limiter: allow N calls per windowMs milliseconds
    const limiter = new Bottleneck({
      minTime: windowMs / maxAttempts, // Spread calls evenly across window
      maxConcurrent: 1, // Only one LLM call per user at a time
      reservoir: maxAttempts, // Start with N available "slots"
      reservoirRefreshAmount: maxAttempts,
      reservoirRefreshInterval: windowMs,
    });
    userLimiters.set(key, limiter);
  }
  return userLimiters.get(key)!;
}

export async function checkLlmRateLimit(
  userId: string,
  maxAttempts?: number,
  windowMs?: number
): Promise<void> {
  const limiter = createUserRateLimiter(userId, maxAttempts, windowMs);
  try {
    // Schedule an async function through the limiter
    // If rate limited, this will throw when the limiter rejects
    await limiter.schedule(async () => {
      // No-op; just verify the user is within rate limits
    });
  } catch {
    throw new Error("Too many AI requests. Please wait a few minutes before trying again.");
  }
}
