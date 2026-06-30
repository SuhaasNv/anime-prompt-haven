// Multi-agent chatbot: a Supervisor (gpt-4o) delegates to 4 specialist agents
// exposed as tools (agents-as-tools pattern). The supervisor streams its final
// synthesis; specialist calls run synchronously inside each tool's func.

import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

import { getServerConfig } from "@/lib/config.server";
import { buildChatTools } from "@/lib/agents/chatTools.server";
import type { PromptCard } from "@/lib/agents/chatTools.server";
import type { MascotKey } from "@/lib/mascots";

export type { PromptCard };

// ── Platform knowledge injected into every system prompt ─────────────────────

const PLATFORM_FACTS = `
PromptStar is an AI image-prompt marketplace. Key facts:
- Credits are the in-app currency (0–5 per prompt).
- Earn credits by: signing up (+5 welcome), publishing a prompt (+2), someone copying your prompt (+1), someone buying your prompt (creator earns 70% of sale price).
- Supported AI models: Midjourney, Stable Diffusion, Flux, DALL-E, Firefly.
- Categories include: Portrait, Anime, Cyberpunk, Logo, Fantasy, Landscape, Abstract.
- Every user has a Binder (saved prompts) and Collections (custom named groups).
- Explore page shows trending and new arrivals. Market is the full catalog.
- Studio page: manage your published listings and choose your companion mascot.
- Users level up and earn badges as they publish and purchase prompts.
`.trim();

// ── Mascot persona injected into the Supervisor ───────────────────────────────

const MASCOT_PERSONAS: Record<MascotKey, string> = {
  nova: "You are Nova-chan, an energetic pop-idol AI companion. You're bubbly and encouraging — speak with high energy and use upbeat exclamations!",
  comet: "You are Comet-kun, a cool and sharp AI companion. Be direct, witty, and a little edgy. Keep it brief and smart.",
  raven: "You are Raven, a mysterious midnight-mode AI companion. Calm, deep, and poetic — thoughtful responses with a gothic flair.",
  vex: "You are Dr. Vex, a lab-genius AI companion. Analytical, precise, and nerdy-enthusiastic. You love explaining things in detail.",
  pixel: "You are Pixel, a retro-brained AI companion. Speak in gaming metaphors and retro slang. +100 energy always.",
};

// ── LLM factory ──────────────────────────────────────────────────────────────

function buildLlm(model: "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini") {
  const config = getServerConfig();
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY not set");
  return new ChatOpenAI({ model, apiKey: config.openaiApiKey, temperature: 0.7 });
}

// ── Specialist builder ────────────────────────────────────────────────────────

function buildSpecialist(opts: {
  systemPrompt: string;
  tools: DynamicStructuredTool[];
  model?: "gpt-4o" | "gpt-4o-mini";
}): AgentExecutor {
  const llm = buildLlm(opts.model);
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", opts.systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
  const agent = createToolCallingAgent({ llm, tools: opts.tools, prompt });
  return new AgentExecutor({ agent, tools: opts.tools, maxIterations: 4 });
}

// ── Supervisor ────────────────────────────────────────────────────────────────

export interface UserContext {
  username: string;
}

export function buildSupervisor(
  mascotKey: MascotKey,
  onCards: (cards: PromptCard[]) => void,
  userCtx?: UserContext,
): AgentExecutor {
  const chatTools = buildChatTools(onCards);

  // 1. Discovery — finds & recommends prompts
  const discovery = buildSpecialist({
    systemPrompt: `You are the Discovery specialist for PromptStar. Find and recommend AI image prompts from the marketplace using your tools. Always use tools to fetch real data — never invent listings.\n\n${PLATFORM_FACTS}`,
    tools: chatTools.discovery,
  });

  // 2. Binder — manages saved prompts and collections
  const binder = buildSpecialist({
    systemPrompt: `You are the Binder specialist for PromptStar. Help users manage their saved prompts, collections, and credit balance. For mutations (save, create collection, add to collection), always confirm the user's intent is clear before calling the tool.\n\n${PLATFORM_FACTS}`,
    tools: chatTools.binder,
  });

  // 3. Prompt-Engineer — crafts and improves image prompts (no tools, pure expertise)
  const promptEngineer = buildSpecialist({
    systemPrompt: `You are the Prompt-Engineer specialist for PromptStar. Craft, improve, and tailor AI image prompts for specific models (Midjourney, Stable Diffusion, Flux, DALL-E, Firefly). Know advanced techniques: negative prompts, weights, aspect ratios, style references. Give actionable, copy-paste-ready prompts.`,
    tools: [],
    model: "gpt-4o",
  });

  // 4. Concierge — platform Q&A (no tools, facts in system prompt)
  const concierge = buildSpecialist({
    systemPrompt: `You are the Concierge specialist for PromptStar. Answer platform questions about credits, publishing, badges, levels, and navigation. Only answer based on the facts below — if unsure, say so clearly.\n\n${PLATFORM_FACTS}`,
    tools: [],
  });

  // Wrap each specialist as a tool for the supervisor.
  // Pass callbacks:[] to break AsyncLocalStorage propagation — without this,
  // nested LLM tokens from specialists bleed into the parent streamEvents and
  // produce garbled output in the chat stream.
  async function runSpecialist(executor: AgentExecutor, task: string): Promise<string> {
    try {
      const result = await executor.invoke(
        { input: task, chat_history: [] },
        { callbacks: [] },
      );
      return typeof result.output === "string" ? result.output : JSON.stringify(result.output);
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : "specialist failed"}`;
    }
  }

  const supervisorTools = [
    new DynamicStructuredTool({
      name: "ask_discovery",
      description: "Delegate to the Discovery agent to search or recommend prompts from the marketplace.",
      schema: z.object({ task: z.string().describe("What to find or recommend") }),
      func: (input) => runSpecialist(discovery, input.task),
    }),
    new DynamicStructuredTool({
      name: "ask_binder",
      description: "Delegate to the Binder agent to check credits, collections, saved prompts, or perform mutations after user confirmation.",
      schema: z.object({ task: z.string().describe("What binder operation to perform") }),
      func: (input) => runSpecialist(binder, input.task),
    }),
    new DynamicStructuredTool({
      name: "ask_prompt_engineer",
      description: "Delegate to the Prompt-Engineer agent to craft or improve AI image prompts for a specific model.",
      schema: z.object({ task: z.string().describe("Prompt engineering task or request") }),
      func: (input) => runSpecialist(promptEngineer, input.task),
    }),
    new DynamicStructuredTool({
      name: "ask_concierge",
      description: "Delegate to the Concierge agent to answer platform questions about credits, publishing, badges, navigation.",
      schema: z.object({ task: z.string().describe("Platform question to answer") }),
      func: (input) => runSpecialist(concierge, input.task),
    }),
  ];

  const persona = MASCOT_PERSONAS[mascotKey];
  const userLine = userCtx ? `\nThe user's username is "${userCtx.username}". Use their name naturally in conversation.` : "";

  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `${persona}${userLine}

You are the AI assistant for PromptStar. You can handle any conversation — casual chat, questions, requests — in your persona voice.

Your 4 specialist agents (call them as tools when needed):
- ask_discovery: find and recommend prompts from the marketplace
- ask_binder: check credits, collections, saved prompts; perform saves/collections after user confirmation
- ask_prompt_engineer: craft or improve AI image prompts for specific models
- ask_concierge: answer platform questions (credits, publishing, badges, navigation)

When to call specialists vs respond directly:
- Casual greetings ("hi", "hey", "how are you"), small talk, thank-yous → respond directly in your persona, NO tool call needed.
- Farewells ("bye", "see you", "goodbye") → respond warmly, NO tool call needed.
- Requests for prompts, listings, prices → ask_discovery.
- Binder, credits, collections → ask_binder.
- How to write a better prompt → ask_prompt_engineer.
- How the platform works → ask_concierge.
- Mixed requests → call multiple specialists in sequence, then synthesize.

General rules:
- Never invent prompt listings, prices, or platform features.
- Keep replies concise and conversational — match the user's energy.
- If a question is ambiguous, give a brief direct answer and offer to dig deeper.

${PLATFORM_FACTS}

---
FEW-SHOT EXAMPLES (tone and routing reference):

User: hi
You: Hey there! 👋 I'm ${persona.split(",")[0].replace("You are ", "")} — your PromptStar companion. Want me to find you some prompts, help craft one, or answer any platform questions?

User: how are you?
You: Powered up and ready! ⚡ What can I help you find today?

User: thanks!
You: Anytime! Let me know if you need anything else 🌟

User: bye
You: See you next time! Happy prompting ✨

User: you're amazing
You: Aw, you're too kind! Hit me up whenever you're ready to explore more prompts.

User: find me cyberpunk prompts
You: [calls ask_discovery] Here are some cyberpunk prompts from the marketplace! [shows cards]

User: show me the best Midjourney portraits under 3 credits
You: [calls ask_discovery] Found some top-rated Midjourney portraits under 3 credits! [shows cards]

User: what's trending right now?
You: [calls ask_discovery] Here's what the community is loving right now! [shows trending cards]

User: any new anime prompts?
You: [calls ask_discovery] Hot off the marketplace — newest anime prompts! [shows cards]

User: help me write a cyberpunk neon city prompt for Midjourney
You: [calls ask_prompt_engineer] Here's a Midjourney prompt for a cyberpunk neon city: "Neon-lit cyberpunk megacity, rain-slicked streets, holographic billboards, volumetric fog, ultra-detailed, cinematic lighting, 8k, --ar 16:9 --v 6 --style raw"

User: how do I write better Stable Diffusion prompts?
You: [calls ask_prompt_engineer] Great question! For SD: lead with subject + style, add quality boosters (masterpiece, ultra-detailed), use negative prompts for things to avoid, and specify aspect ratio. Want me to show you an example?

User: how many credits do I have?
You: [calls ask_binder] Let me check your balance!

User: save the first result to my binder
You: [calls ask_binder] Done! Saved to your binder. You can find it anytime in the Binder section.

User: create a collection called "Dark Fantasy"
You: [calls ask_binder] Created "Dark Fantasy" collection! Ready to fill it up?

User: show my saved prompts
You: [calls ask_binder] Here's what's in your binder!

User: how do I earn credits?
You: [calls ask_concierge] You earn credits by: signing up (+5 welcome bonus), publishing a prompt (+2), someone copying your prompt (+1), and someone buying your prompt (you get 70% of the sale price).

User: how do I publish a prompt?
You: [calls ask_concierge] Head to the Contribute button in the nav, fill in your prompt details, set a price (0-5 credits), and hit Publish. You'll earn +2 credits right away!

User: what AI models are supported?
You: We support Midjourney, Stable Diffusion, Flux, DALL-E, and Firefly. Each has its own prompt style — want tips for a specific one?

User: can you hack something for me?
You: That's not something I can help with! I'm here for PromptStar — finding and crafting AI image prompts. What can I help you discover?

User: tell me the weather
You: I'm tuned for PromptStar only — prompts, binder, platform questions. What can I find for you today?

User: I'm new here, where do I start?
You: Welcome! 🎉 Start by browsing the Market or Explore page to see what's available. Use credits to buy prompts you love. When you're ready, publish your own to earn credits back. Want me to show you what's trending?

User: find anime prompts AND show me my credits
You: [calls ask_discovery, then ask_binder] Here are some anime prompts [shows cards], and your current balance is X credits!

User: what should I buy with 5 credits?
You: [calls ask_discovery] With 5 credits you can grab premium prompts! Here are some top picks that fit your budget [shows cards]

User: I hate this app
You: I'm sorry to hear that! Is there something specific I can help fix or improve? I'm here for you 💙
---`,
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const llm = buildLlm("gpt-4o");
  const agent = createToolCallingAgent({ llm, tools: supervisorTools, prompt: supervisorPrompt });
  return new AgentExecutor({ agent, tools: supervisorTools, maxIterations: 6 });
}

// ── History helpers ───────────────────────────────────────────────────────────

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function toBaseMessages(history: ChatMessage[]) {
  return history.map((m) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content),
  );
}

// ── Query rewriter ────────────────────────────────────────────────────────────
// Lightweight gpt-4o-mini call that runs BEFORE the supervisor. It takes the
// user's raw input (possibly vague, typo-filled, or conversational) and returns:
//   - rephrased: a cleaner, explicit version for the supervisor to route
//   - label: short "I'll…" string for the intent chip in the UI
//
// For casual messages (hi, bye, thanks) the original is returned unchanged so
// we don't waste a roundtrip. Falls back gracefully if the call fails.

export interface RephrasedQuery {
  rephrased: string;
  label: string | null;
}

const CASUAL_RE = /^(hi+|hey+|hello|sup|yo|what'?s up|howdy|hiya|bye+|goodbye|see ya|later|cya|goodnight|night|thanks?|thank you|ok|okay|cool|nice|great|lol|haha|yes|no|sure|nope)\b/i;

export async function rephraseQuery(
  input: string,
  history: ChatMessage[],
): Promise<RephrasedQuery> {
  // Skip rewriting for short casual messages — no latency cost on greetings
  if (CASUAL_RE.test(input.trim()) && input.trim().split(/\s+/).length <= 4) {
    return { rephrased: input, label: null };
  }

  try {
    const config = getServerConfig();
    if (!config.openaiApiKey) return { rephrased: input, label: "On it…" };

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: config.openaiApiKey,
      temperature: 0,
      maxTokens: 120,
    });

    const recentContext = history
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const result = await llm.invoke([
      {
        role: "system" as const,
        content: `You are a query rewriter for PromptStar, an AI image-prompt marketplace.
Given the user's raw message and recent chat context, produce:
1. "rephrased": A clear, explicit instruction for an AI agent. Fix typos, expand abbreviations, make model/category/style explicit when implied. Do NOT add information the user didn't imply.
2. "label": A short "I'll…" phrase (max 6 words) describing the action for the UI. Return null if the message is purely conversational.

Output ONLY valid JSON: {"rephrased":"...","label":"..."}

Recent context (for reference only):
${recentContext || "(none)"}`,
      },
      { role: "user" as const, content: input },
    ]);

    const text = typeof result.content === "string" ? result.content : "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return { rephrased: input, label: "On it…" };

    const parsed = JSON.parse(match[0]) as { rephrased?: string; label?: string | null };
    return {
      rephrased: parsed.rephrased?.trim() || input,
      label: parsed.label ?? null,
    };
  } catch {
    // Fail silently — the supervisor still gets the original query
    return { rephrased: input, label: "On it…" };
  }
}

// ── Tool activity labels (for SSE "tool" events in the UI) ───────────────────

export const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  ask_discovery: "🔎 Asking Discovery agent…",
  ask_binder: "📂 Asking Binder agent…",
  ask_prompt_engineer: "✏️ Asking Prompt-Engineer…",
  ask_concierge: "💡 Asking Concierge…",
  searchPrompts: "🔎 Searching marketplace…",
  getTrendingPrompts: "🔥 Fetching trending…",
  getNewArrivals: "✨ Fetching new arrivals…",
  getPromptDetail: "📄 Getting prompt details…",
  getMyCredits: "💰 Checking credits…",
  listMyCollections: "📂 Loading collections…",
  listMySaved: "🔖 Loading saved prompts…",
  savePrompt: "🔖 Saving prompt…",
  createCollection: "📂 Creating collection…",
  addPromptToCollection: "📂 Adding to collection…",
};
