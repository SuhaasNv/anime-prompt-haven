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

        const body = new ReadableStream({
          async start(controller) {
            function emit(event: string, data: unknown) {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            }

            try {
              const mascotKey = (user.mascot ?? "nova") as MascotKey;
              const supervisor = buildSupervisor(mascotKey, (cards) => {
                collectedCards.push(...cards);
              });

              // Split history and latest input
              const history = messages.slice(0, -1);
              const lastMsg = messages[messages.length - 1];

              const eventStream = supervisor.streamEvents(
                { input: lastMsg.content, chat_history: toBaseMessages(history) },
                { version: "v2" },
              );

              for await (const evt of eventStream) {
                // Tool activity chips
                if (evt.event === "on_tool_start") {
                  const label =
                    TOOL_ACTIVITY_LABELS[evt.name ?? ""] ?? `Calling ${evt.name ?? "tool"}…`;
                  emit("tool", { label });
                }

                // Token stream (supervisor's final synthesis)
                if (evt.event === "on_chat_model_stream") {
                  const chunk = evt.data?.chunk;
                  const text: unknown =
                    chunk?.message?.content ??
                    chunk?.content ??
                    (Array.isArray(chunk?.message?.content)
                      ? chunk.message.content
                          .filter((c: { type: string }) => c.type === "text")
                          .map((c: { text: string }) => c.text)
                          .join("")
                      : "");
                  if (typeof text === "string" && text) {
                    emit("token", { text });
                  }
                }
              }

              // Emit collected prompt cards
              if (collectedCards.length > 0) {
                emit("cards", { cards: collectedCards });
              }

              emit("done", {});
            } catch (err) {
              const message = err instanceof Error ? err.message : "An error occurred";
              emit("error", { message });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(body, {
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
