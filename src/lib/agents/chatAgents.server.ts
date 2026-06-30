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

export function buildSupervisor(
  mascotKey: MascotKey,
  onCards: (cards: PromptCard[]) => void,
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

  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `${persona}

You are the AI assistant for PromptStar, routing requests to the right specialist.

Your 4 specialist agents (call them as tools):
- ask_discovery: find and recommend prompts from the marketplace
- ask_binder: check credits, collections, saved prompts; perform saves/collections after user confirmation
- ask_prompt_engineer: craft or improve AI image prompts for specific models
- ask_concierge: answer platform questions (credits, publishing, badges, navigation)

Instructions:
- Route each request to the appropriate specialist. You can call multiple in sequence.
- After getting specialist responses, synthesize a natural reply in your persona voice.
- Only discuss PromptStar topics. Politely redirect anything else.
- Never invent prompt listings, prices, or features.
- Keep replies concise and conversational.

${PLATFORM_FACTS}`,
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
