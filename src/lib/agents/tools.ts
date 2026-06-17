import { z } from "zod";
import { getOpenAIClient } from "../llm.server";
import { TAGS } from "../mock-data";

// Helper to parse JSON that may be wrapped in markdown code blocks
function parseJSON(text: string): unknown {
  // Try direct parsing first
  try {
    return JSON.parse(text);
  } catch {
    // If that fails, try extracting from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // If still no match, throw original error
    throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
  }
}

// LLMs occasionally overshoot a character limit despite explicit instructions.
// The marketplace enforces hard caps (280 for descriptions, 80 for titles), so
// clamp the model's text to the cap at a word boundary instead of failing the
// whole suggestion when it runs a few characters long.
function clampField(json: unknown, field: string, max: number): unknown {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    const value = record[field];
    if (typeof value === "string" && value.length > max) {
      let truncated = value.slice(0, max);
      const lastSpace = truncated.lastIndexOf(" ");
      // Prefer a word boundary, but only if it doesn't cut off too much text.
      if (lastSpace > max - 40) {
        truncated = truncated.slice(0, lastSpace);
      }
      record[field] = truncated.trimEnd();
    }
  }
  return json;
}

// Helper to add timeout to async operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} took too long (>${timeoutMs}ms). OpenAI API may be slow or unreachable.`)), timeoutMs)
    ),
  ]);
}

// Output schemas for agent responses
export const TagSuggestionSchema = z.object({
  tags: z.array(z.string()).describe("Array of 3-6 suggested tags from the curated list"),
  reasoning: z.string().describe("Brief explanation of why these tags fit"),
});
export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;

export const PriceTierSchema = z.object({
  tier: z.number().int().min(0).max(5).describe("Suggested price tier (0-5)"),
  reasoning: z.string().describe("Brief explanation based on prompt complexity and value"),
});
export type PriceTier = z.infer<typeof PriceTierSchema>;

export const DescriptionSchema = z.object({
  polished: z.string().min(10).max(280).describe("Polished, compelling description"),
  improvements: z.array(z.string()).describe("List of improvements made"),
});
export type PolishedDescription = z.infer<typeof DescriptionSchema>;

export const TitleGenerationSchema = z.object({
  title: z.string().min(2).max(80).describe("Generated title for the prompt"),
});
export type TitleGeneration = z.infer<typeof TitleGenerationSchema>;

export const DescriptionGenerationSchema = z.object({
  description: z.string().min(10).max(280).describe("Generated description for the marketplace"),
});
export type DescriptionGeneration = z.infer<typeof DescriptionGenerationSchema>;

/**
 * Suggest tags from the curated list based on title, description, and body.
 * Returns 3-6 tags that best match the prompt's content and style.
 */
export async function suggestTags(input: {
  title: string;
  description: string;
  body: string;
  category: string;
}): Promise<TagSuggestion> {
  const client = getOpenAIClient();
  const curatedTags = TAGS.join(", ");

  const response = await withTimeout(
    client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are an expert at tagging AI image generation prompts.

Given this prompt, suggest the 3-6 best tags from this curated list: ${curatedTags}

Prompt:
Title: "${input.title}"
Description: "${input.description}"
Body: "${input.body}"
Category: "${input.category}"

Return a JSON object with:
- "tags": array of 3-6 tags from the curated list (include # symbol)
- "reasoning": one sentence explaining why these tags fit

Be concise and specific to the prompt's content and style.`,
        },
      ],
    }),
    15000,
    "Tag suggestion"
  );

  const message = response.choices[0].message.content;
  if (!message) {
    throw new Error("Empty response from OpenAI");
  }

  try {
    const json = parseJSON(message);
    return TagSuggestionSchema.parse(json);
  } catch (e) {
    throw new Error(`Failed to parse tag suggestions: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Suggest a price tier (0-5) based on prompt complexity, detail level, and potential value.
 * Considers the category and estimated effort to generate good results.
 */
export async function suggestPriceTier(input: {
  title: string;
  body: string;
  category: string;
}): Promise<PriceTier> {
  const client = getOpenAIClient();

  const response = await withTimeout(
    client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `You are pricing expert for AI image generation prompts.

Evaluate this prompt's value and suggest a price tier (0-5 credits):
- 0: Free (basic, beginner-friendly)
- 1-2: Budget (simple, good for learning)
- 3-4: Premium (detailed, specialized, high-value)
- 5: Pro (extremely detailed, expert-level, rare techniques)

Prompt:
Title: "${input.title}"
Body: "${input.body}"
Category: "${input.category}"

Consider:
- Specificity and detail level
- How useful/reusable it is
- Effort to create
- Category-typical pricing

Return JSON with:
- "tier": number 0-5
- "reasoning": one sentence explaining the tier

Be fair but not overpriced. Most prompts are 1-3 credits.`,
        },
      ],
    }),
    15000,
    "Price suggestion"
  );

  const message = response.choices[0].message.content;
  if (!message) {
    throw new Error("Empty response from OpenAI");
  }

  try {
    const json = parseJSON(message);
    return PriceTierSchema.parse(json);
  } catch (e) {
    throw new Error(`Failed to parse price suggestion: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Generate a compelling title for a prompt based on its image using vision analysis.
 * Returns a title that captures the essence of the image in 2-80 characters.
 */
export async function generateTitleFromImageVision(imageDataUrl: string): Promise<TitleGeneration> {
  const client = getOpenAIClient();

  const response = await withTimeout(
    client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert at creating compelling titles for AI image generation prompts.

Analyze this image and generate a short, catchy title (2-80 characters) that captures its essence and style.
The title should be descriptive yet concise, suitable for an AI prompt marketplace.

Examples: "Golden Hour Portrait", "Cyberpunk Neon City", "Underwater Alien Creature"

Return JSON with:
- "title": the generated title (2-80 chars)`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
    }),
    10000,
    "Title generation from image"
  );

  const message = response.choices[0].message.content;
  if (!message || typeof message !== "string") {
    throw new Error("Empty response from OpenAI vision");
  }

  try {
    const json = parseJSON(message);
    return TitleGenerationSchema.parse(clampField(json, "title", 80));
  } catch (e) {
    throw new Error(`Failed to generate title: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Generate a compelling marketplace description for a prompt based on its image using vision analysis.
 * Returns a description that highlights what makes the image special (10-280 characters).
 */
export async function generateDescriptionFromImageVision(imageDataUrl: string): Promise<DescriptionGeneration> {
  const client = getOpenAIClient();

  const response = await withTimeout(
    client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a copywriter specializing in AI prompt marketplace descriptions.

Analyze this image and generate a compelling marketplace description (10-280 characters) that highlights its unique qualities and appeals to buyers.
The description should be enticing and capture what makes this image special.

Examples: "Neon-lit cyberpunk cityscape with rain reflections and moody atmosphere", "Ethereal underwater scene with bioluminescent creatures and crystal formations"

Return JSON with:
- "description": the generated description (10-280 chars)`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
    }),
    10000,
    "Description generation from image"
  );

  const message = response.choices[0].message.content;
  if (!message || typeof message !== "string") {
    throw new Error("Empty response from OpenAI vision");
  }

  try {
    const json = parseJSON(message);
    return DescriptionGenerationSchema.parse(clampField(json, "description", 280));
  } catch (e) {
    throw new Error(`Failed to generate description: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Polish the marketplace description to be more compelling while staying within 280 chars.
 * Improves clarity, adds hooks, and makes it more enticing to buyers.
 */
export async function polishDescription(input: {
  currentDescription: string;
  title: string;
  body: string;
  category: string;
}): Promise<PolishedDescription> {
  const client = getOpenAIClient();

  const response = await withTimeout(
    client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      messages: [
        {
          role: "user",
          content: `You are a copywriter specializing in AI prompt listings.

Improve this marketplace description to be more compelling and enticing while staying under 280 characters.

Current description: "${input.currentDescription}"
Title: "${input.title}"
Prompt body: "${input.body}"
Category: "${input.category}"

Your improved description should:
- Highlight what makes this prompt special
- Use action words and benefits
- Stay under 280 characters
- Be clear about what the buyer will get
- Include a hook that makes them want to click

Return JSON with:
- "polished": the improved description (under 280 chars)
- "improvements": array of 2-3 specific improvements you made (e.g., "Added benefit statement", "Removed filler words")`,
        },
      ],
    }),
    15000,
    "Description polishing"
  );

  const message = response.choices[0].message.content;
  if (!message) {
    throw new Error("Empty response from OpenAI");
  }

  try {
    const json = parseJSON(message);
    return DescriptionSchema.parse(clampField(json, "polished", 280));
  } catch (e) {
    throw new Error(`Failed to parse description polish: ${e instanceof Error ? e.message : String(e)}`);
  }
}
