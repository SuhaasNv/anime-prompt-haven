import { z } from "zod";
import { suggestTags, suggestPriceTier, polishDescription } from "./tools";

/**
 * Comprehensive listing assistance that suggests tags, price tier, and polishes description.
 * Runs all three tools in parallel and returns combined results.
 */
export interface ListingAssistanceInput {
  title: string;
  description: string;
  body: string;
  category: string;
}

export interface ListingAssistanceResult {
  suggestedTags: string[];
  tagReasoning: string;
  suggestedPrice: number;
  priceReasoning: string;
  polishedDescription: string;
  descriptionImprovements: string[];
}

const ListingAssistanceOutputSchema = z.object({
  suggestedTags: z.array(z.string()),
  tagReasoning: z.string(),
  suggestedPrice: z.number().int().min(0).max(5),
  priceReasoning: z.string(),
  polishedDescription: z.string(),
  descriptionImprovements: z.array(z.string()),
});

export type ListingAssistanceOutput = z.infer<typeof ListingAssistanceOutputSchema>;

/**
 * Run the listing assistant agent.
 * This calls all three tools in parallel and aggregates results.
 *
 * @param input The listing input to analyze
 * @returns Suggested tags, price tier, and polished description
 */
export async function runListingAssistant(
  input: ListingAssistanceInput
): Promise<ListingAssistanceOutput> {
  // Validate input
  if (!input.title || input.title.length < 2) {
    throw new Error("Title is required (at least 2 characters)");
  }
  if (!input.description || input.description.length < 10) {
    throw new Error("Description is required (at least 10 characters)");
  }
  if (!input.body || input.body.length < 10) {
    throw new Error("Prompt body is required (at least 10 characters)");
  }
  if (!input.category) {
    throw new Error("Category is required");
  }

  // Run all three tools in parallel
  try {
    const [tagsResult, priceResult, descriptionResult] = await Promise.all([
      suggestTags({
        title: input.title,
        description: input.description,
        body: input.body,
        category: input.category,
      }),
      suggestPriceTier({
        title: input.title,
        body: input.body,
        category: input.category,
      }),
      polishDescription({
        currentDescription: input.description,
        title: input.title,
        body: input.body,
        category: input.category,
      }),
    ]);

    // Combine results
    const result: ListingAssistanceOutput = {
      suggestedTags: tagsResult.tags,
      tagReasoning: tagsResult.reasoning,
      suggestedPrice: priceResult.tier,
      priceReasoning: priceResult.reasoning,
      polishedDescription: descriptionResult.polished,
      descriptionImprovements: descriptionResult.improvements,
    };

    // Validate output before returning
    return ListingAssistanceOutputSchema.parse(result);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Listing assistant failed: ${error.message}`);
    }
    throw error;
  }
}
