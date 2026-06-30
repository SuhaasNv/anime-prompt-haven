// Tools for the agentic chatbot. Each wraps an existing server function so all
// auth, validation, and id handling is reused. The agent runs inside the chat
// request context, so the cookie-based session propagates into these calls.
//
// Read tools that surface listings push compact "cards" into a collector so the
// chat UI can render rich prompt cards alongside the reply.

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

import { listListings, getListing } from "@/lib/api/listings.functions";
import { getNewArrivals, getTrendingPrompts } from "@/lib/api/explore.functions";
import { getMyCredits } from "@/lib/api/credits.functions";
import { listCollections, createCollection, addPromptToCollection } from "@/lib/api/collections.functions";
import { savePrompt, listSavedPrompts } from "@/lib/api/saves.functions";

export interface PromptCard {
  id: string;
  title: string;
  price: number;
  model: string;
  creator: string;
  rating: number | null;
}

type AnyPrompt = {
  id: string;
  title: string;
  price: number;
  model: string;
  creator: string;
  rating?: number | null;
};

function toCard(p: AnyPrompt): PromptCard {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    model: p.model,
    creator: p.creator,
    rating: p.rating ?? null,
  };
}

/** Wrap a tool body so any error returns a string the agent can recover from. */
async function safe(fn: () => Promise<unknown>): Promise<string> {
  try {
    const out = await fn();
    return JSON.stringify(out);
  } catch (err) {
    return `ERROR: ${err instanceof Error ? err.message : "tool failed"}`;
  }
}

export function buildChatTools(onCards: (cards: PromptCard[]) => void) {
  const collect = (prompts: AnyPrompt[]) => {
    const cards = prompts.slice(0, 6).map(toCard);
    if (cards.length > 0) onCards(cards);
    return cards;
  };

  const searchPrompts = new DynamicStructuredTool({
    name: "searchPrompts",
    description:
      "Search the marketplace for prompts. Filter by category, model, max price (credits), and sort. Optional titleContains does a case-insensitive title/description match. Returns compact prompt summaries.",
    schema: z.object({
      category: z.string().optional().describe("e.g. Portrait, Anime, Cyberpunk, Logo"),
      model: z.string().optional().describe("target model, e.g. Midjourney, Stable Diffusion, Flux, DALL-E"),
      maxPrice: z.number().optional().describe("maximum price in credits (0-5)"),
      sort: z.enum(["newest", "trending", "price_asc", "price_desc", "rating"]).optional(),
      titleContains: z.string().optional().describe("free-text to match in title/description"),
      limit: z.number().int().min(1).max(12).optional(),
    }),
    func: async (input) =>
      safe(async () => {
        const data: Record<string, unknown> = { limit: input.limit ?? 8, sort: input.sort ?? "newest" };
        if (input.category) data.category = input.category;
        if (input.model) data.model = input.model;
        if (typeof input.maxPrice === "number") data.maxPrice = input.maxPrice;
        let prompts = (await listListings({ data })) as AnyPrompt[];
        if (input.titleContains) {
          const q = input.titleContains.toLowerCase();
          prompts = prompts.filter((p) =>
            `${p.title} ${(p as { description?: string }).description ?? ""}`.toLowerCase().includes(q),
          );
        }
        return collect(prompts);
      }),
  });

  const trending = new DynamicStructuredTool({
    name: "getTrendingPrompts",
    description: "Get the most popular/trending prompts right now.",
    schema: z.object({ limit: z.number().int().min(1).max(12).optional() }),
    func: async (input) =>
      safe(async () => collect((await getTrendingPrompts({ data: { limit: input.limit ?? 6 } })) as AnyPrompt[])),
  });

  const newArrivals = new DynamicStructuredTool({
    name: "getNewArrivals",
    description: "Get the newest prompts added to the marketplace.",
    schema: z.object({ limit: z.number().int().min(1).max(12).optional() }),
    func: async (input) =>
      safe(async () => collect((await getNewArrivals({ data: { limit: input.limit ?? 6 } })) as AnyPrompt[])),
  });

  const promptDetail = new DynamicStructuredTool({
    name: "getPromptDetail",
    description: "Get full details of a single prompt by its id (title, description, price, model, tags, creator, rating).",
    schema: z.object({ id: z.string().uuid() }),
    func: async (input) =>
      safe(async () => {
        const p = (await getListing({ data: { id: input.id } })) as AnyPrompt | null;
        if (p) collect([p]);
        return p;
      }),
  });

  const myCredits = new DynamicStructuredTool({
    name: "getMyCredits",
    description: "Get the current user's credit balance.",
    schema: z.object({}),
    func: async () => safe(async () => getMyCredits()),
  });

  const myCollections = new DynamicStructuredTool({
    name: "listMyCollections",
    description: "List the current user's collections (id, name, vibe, color).",
    schema: z.object({}),
    func: async () => safe(async () => listCollections()),
  });

  const mySaved = new DynamicStructuredTool({
    name: "listMySaved",
    description: "List the prompts the current user has saved to their binder.",
    schema: z.object({}),
    func: async () =>
      safe(async () => collect((await listSavedPrompts()) as AnyPrompt[])),
  });

  // --- Mutations: the agent must confirm with the user before calling these. ---

  const save = new DynamicStructuredTool({
    name: "savePrompt",
    description:
      "Save a prompt to the user's binder. ONLY call after the user has explicitly confirmed. Needs the prompt's UUID listingId.",
    schema: z.object({ listingId: z.string().uuid() }),
    func: async (input) => safe(async () => savePrompt({ data: { listingId: input.listingId } })),
  });

  const makeCollection = new DynamicStructuredTool({
    name: "createCollection",
    description:
      "Create a new collection in the user's binder. ONLY call after explicit confirmation. color is one of magenta|orange|yellow|purple.",
    schema: z.object({
      name: z.string().min(1).max(60),
      vibe: z.string().max(120).optional(),
      color: z.enum(["magenta", "orange", "yellow", "purple"]).optional(),
    }),
    func: async (input) =>
      safe(async () =>
        createCollection({ data: { name: input.name, vibe: input.vibe, color: input.color } }),
      ),
  });

  const addToCollection = new DynamicStructuredTool({
    name: "addPromptToCollection",
    description:
      "Add a prompt to one of the user's collections. ONLY call after explicit confirmation. Needs collectionId and the prompt UUID promptId.",
    schema: z.object({ collectionId: z.string().uuid(), promptId: z.string().uuid() }),
    func: async (input) =>
      safe(async () =>
        addPromptToCollection({ data: { collectionId: input.collectionId, promptId: input.promptId } }),
      ),
  });

  return {
    discovery: [searchPrompts, trending, newArrivals, promptDetail],
    binder: [myCredits, myCollections, mySaved, save, makeCollection, addToCollection],
  };
}
