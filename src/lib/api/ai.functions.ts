import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSessionUser } from "../auth.server";
import { checkLlmRateLimit } from "../llm.server";
import { runListingAssistant } from "../agents/listingAssistant";
import { sanitize } from "../sanitize";

// Rate limiting for AI requests: more aggressive than normal operations
// 5 requests per hour per user (since each LLM call costs money)
const LISTING_ASSIST_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LISTING_ASSIST_RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * Generate a description for a prompt based on its image using OpenAI vision.
 *
 * Input: imageDataUrl (base64 data URL)
 * Output: generatedDescription
 *
 * Requires authentication. Rate limited to 10 calls/hour per user (separate from listing assistance).
 */
export const generateDescriptionFromImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      imageDataUrl: z.string().startsWith("data:image/"),
    })
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) {
      throw new Error("You must be signed in to use AI description generation.");
    }

    // Rate limit description generation (same as title: 10 calls per hour)
    await checkLlmRateLimit(
      `desc-gen:${user.id}`,
      10, // 10 calls per hour
      60 * 60 * 1000
    );

    try {
      const { generateDescriptionFromImageVision } = await import("../agents/tools");
      const result = await generateDescriptionFromImageVision(data.imageDataUrl);
      return {
        ok: true as const,
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate description";
      throw new Error(message);
    }
  });

/**
 * Generate a title for a prompt based on its image using OpenAI vision.
 *
 * Input: imageDataUrl (base64 data URL)
 * Output: generatedTitle
 *
 * Requires authentication. Rate limited to 10 calls/hour per user (separate from listing assistance).
 */
export const generateTitleFromImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      imageDataUrl: z.string().startsWith("data:image/"),
    })
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) {
      throw new Error("You must be signed in to use AI title generation.");
    }

    // Rate limit title generation separately (more lenient than full assistance)
    await checkLlmRateLimit(
      `title-gen:${user.id}`,
      10, // 10 calls per hour
      60 * 60 * 1000
    );

    try {
      const { generateTitleFromImageVision } = await import("../agents/tools");
      const result = await generateTitleFromImageVision(data.imageDataUrl);
      return {
        ok: true as const,
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate title";
      throw new Error(message);
    }
  });

/**
 * Get listing assistance suggestions (tags, price, description polish) using OpenAI.
 *
 * Input: title, description, body, category
 * Output: suggestedTags, tagReasoning, suggestedPrice, priceReasoning, polishedDescription, descriptionImprovements
 *
 * Requires authentication. Rate limited to 5 calls/hour per user.
 */
export const getListingAssistance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(2).max(80),
      description: z.string().min(10).max(280),
      body: z.string().min(10).max(2000),
      category: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) {
      throw new Error("You must be signed in to use AI assistance.");
    }

    // Rate limit LLM calls (aggressive: 5/hour per user)
    await checkLlmRateLimit(
      `listing-assist:${user.id}`,
      LISTING_ASSIST_RATE_LIMIT_MAX_ATTEMPTS,
      LISTING_ASSIST_RATE_LIMIT_WINDOW_MS
    );

    // Sanitize inputs before passing to LLM
    const sanitizedInput = {
      title: sanitize(data.title),
      description: sanitize(data.description),
      body: sanitize(data.body),
      category: sanitize(data.category),
    };

    try {
      const result = await runListingAssistant(sanitizedInput);
      return {
        ok: true as const,
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI assistance failed";
      throw new Error(message);
    }
  });
