// POST /api/chat — auth-gated, rate-limited SSE streaming agent endpoint.
// Returns a text/event-stream with events: tool, token, cards, error, done.

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getSessionUserFromRequest } from "@/lib/auth.server";
import { checkLlmRateLimit } from "@/lib/llm.server";
import {
  buildSupervisor,
  toBaseMessages,
  TOOL_ACTIVITY_LABELS,
  type ChatMessage,
} from "@/lib/agents/chatAgents.server";
import type { PromptCard } from "@/lib/agents/chatTools.server";
import type { MascotKey } from "@/lib/mascots";
import { logChatEvent } from "@/lib/monitoring.server";

// Keyword-based intent classifier — runs synchronously before the supervisor,
// emitting an immediate "I'll…" signal so the user sees the agent is thinking.
function quickIntentLabel(input: string): string | null {
  const t = input.trim().toLowerCase();
  // Casual greetings / farewells — no label needed
  if (/^(hi+|hey+|hello|sup|yo|what'?s up|howdy|hiya|hola)\b/.test(t)) return null;
  if (/^(bye+|goodbye|see ya|later|cya|goodnight|night)\b/.test(t)) return null;
  // Detect intent by keywords, most-specific first
  if (/\b(find|search|show|recommend|suggest|browse|look for|discover)\b.*\bprompt/.test(t) ||
      /\bprompt.*\b(for|about|of|with)\b/.test(t) ||
      /\b(trending|new arrivals?|what'?s (hot|popular|new))\b/.test(t)) {
    return "🔎 Searching the marketplace…";
  }
  if (/\b(save|binder|collection|saved|my list)\b/.test(t)) return "📂 Checking your binder…";
  if (/\bcredits?\b/.test(t)) return "💰 Checking your credits…";
  if (/\b(craft|write|create|improve|make|build|generate|give me a)\b.*\bprompt/.test(t) ||
      /\bprompt.*\b(for|of|about)\b/.test(t)) {
    return "✏️ Crafting a prompt…";
  }
  if (/\b(how|what|where|when|why|explain|tell me|can i|do i)\b/.test(t)) return "💡 Looking that up…";
  // Generic fallback
  return "💭 On it…";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth ────────────────────────────────────────────────────────────
        const user = await getSessionUserFromRequest(request);
        if (!user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // ── Rate limit: 30 messages per hour ────────────────────────────────
        try {
          await checkLlmRateLimit(`chat:${user.id}`, 30, 3_600_000);
        } catch {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please wait before sending more messages." }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Parse body ──────────────────────────────────────────────────────
        let messages: ChatMessage[];
        try {
          const body = (await request.json()) as { messages: ChatMessage[] };
          messages = Array.isArray(body.messages) ? body.messages : [];
        } catch {
          return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "No messages provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // ── Build SSE stream ─────────────────────────────────────────────────
        const encoder = new TextEncoder();
        const collectedCards: PromptCard[] = [];
        const toolCallsMade: string[] = [];
        const startTime = Date.now();

        const responseBody = new ReadableStream({
          async start(controller) {
            function emit(event: string, data: unknown) {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            }

            let errorMsg: string | undefined;

            try {
              const mascotKey = (user.mascot ?? "nova") as MascotKey;
              const supervisor = buildSupervisor(mascotKey, (cards) => {
                collectedCards.push(...cards);
              });

              // Split history and latest input
              const history = messages.slice(0, -1);
              const lastMsg = messages[messages.length - 1];

              // Emit immediate intent signal so the user sees the agent is processing
              const intentLabel = quickIntentLabel(lastMsg.content);
              if (intentLabel) emit("intent", { label: intentLabel });

              const eventStream = supervisor.streamEvents(
                { input: lastMsg.content, chat_history: toBaseMessages(history) },
                { version: "v2" },
              );

              for await (const evt of eventStream) {
                // Tool activity chips
                if (evt.event === "on_tool_start") {
                  const name = evt.name ?? "";
                  toolCallsMade.push(name);
                  const label = TOOL_ACTIVITY_LABELS[name] ?? `Calling ${name}…`;
                  emit("tool", { label });
                }

                // Token stream — supervisor's final synthesis only.
                // Specialist tokens are isolated via callbacks:[] in runSpecialist.
                if (evt.event === "on_chat_model_stream") {
                  const chunk = evt.data?.chunk;
                  // AIMessageChunk.content is string | ContentBlock[]
                  let text = "";
                  if (typeof chunk?.content === "string") {
                    text = chunk.content;
                  } else if (Array.isArray(chunk?.content)) {
                    for (const block of chunk.content as unknown[]) {
                      if (
                        block !== null &&
                        typeof block === "object" &&
                        (block as Record<string, unknown>).type === "text" &&
                        typeof (block as Record<string, unknown>).text === "string"
                      ) {
                        text += (block as Record<string, unknown>).text as string;
                      }
                    }
                  }
                  if (text) emit("token", { text });
                }
              }

              // Emit collected prompt cards
              if (collectedCards.length > 0) {
                emit("cards", { cards: collectedCards });
              }

              emit("done", {});
            } catch (err) {
              errorMsg = err instanceof Error ? err.message : "An error occurred";
              emit("error", { message: errorMsg });
            } finally {
              controller.close();

              // Fire-and-forget monitoring write (non-blocking)
              void logChatEvent({
                userId: user.id,
                mascot: user.mascot,
                durationMs: Date.now() - startTime,
                toolCalls: toolCallsMade,
                cardCount: collectedCards.length,
                error: errorMsg,
              });
            }
          },
        });

        return new Response(responseBody, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
