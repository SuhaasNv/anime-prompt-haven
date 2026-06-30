// POST /api/chat — auth-gated, rate-limited SSE streaming agent endpoint.
// Returns a text/event-stream with events: tool, token, cards, error, done.

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getSessionUserFromRequest } from "@/lib/auth.server";
import { checkLlmRateLimit } from "@/lib/llm.server";
import {
  buildSupervisor,
  rephraseQuery,
  toBaseMessages,
  TOOL_ACTIVITY_LABELS,
  type ChatMessage,
} from "@/lib/agents/chatAgents.server";
import type { PromptCard } from "@/lib/agents/chatTools.server";
import type { MascotKey } from "@/lib/mascots";
import { logChatEvent } from "@/lib/monitoring.server";

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
              }, { username: user.username });

              // ── Context window management ─────────────────────────────────
              // Keep at most 10 prior turns (20 messages) to stay well within
              // gpt-4o's context budget and bound per-request cost.
              // Strategy: always keep the first exchange (sets the conversation
              // tone) + the most recent N-1 turns so nothing feels abrupt.
              const MAX_HISTORY_TURNS = 10; // pairs of user+assistant
              const allHistory = messages.slice(0, -1);
              const lastMsg = messages[messages.length - 1];

              let history: ChatMessage[];
              if (allHistory.length <= MAX_HISTORY_TURNS * 2) {
                history = allHistory;
              } else {
                // Keep first turn (greeting exchange) + most recent turns
                const head = allHistory.slice(0, 2);
                const tail = allHistory.slice(-(MAX_HISTORY_TURNS * 2 - 2));
                history = [...head, ...tail];
              }

              // Light gpt-4o-mini call: rephrases the user's query into a clear
              // instruction and produces an "I'll…" intent label for the UI chip.
              // Casual messages skip this entirely (no latency cost).
              const { rephrased, label: intentLabel } = await rephraseQuery(
                lastMsg.content,
                history,
              );
              if (intentLabel) emit("intent", { label: intentLabel });

              const eventStream = supervisor.streamEvents(
                { input: rephrased, chat_history: toBaseMessages(history) },
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
