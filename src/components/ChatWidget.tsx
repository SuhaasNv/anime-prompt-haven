// Slide-up chat panel anchored bottom-right (mascot corner).
// Reads the /api/chat SSE stream and renders messages, tool chips, and prompt cards.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import type { MascotKey } from "@/lib/mascots";
import { MASCOTS } from "@/lib/mascots";

// Lightweight markdown renderer — handles the patterns the LLM produces:
// numbered lists, bullet lists, **bold**, and line breaks.
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ol" | "ul" | null = null;

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType!;
    nodes.push(
      <Tag key={nodes.length} className={Tag === "ol" ? "list-decimal pl-5 space-y-0.5 my-1" : "list-disc pl-5 space-y-0.5 my-1"}>
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>,
    );
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const numberedMatch = /^\d+\.\s+(.+)/.exec(line);
    const bulletMatch = /^[-*]\s+(.+)/.exec(line);
    if (numberedMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(numberedMatch[1]);
    } else if (bulletMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(bulletMatch[1]);
    } else {
      flushList();
      if (line.trim() === "") {
        nodes.push(<br key={nodes.length} />);
      } else {
        nodes.push(<span key={nodes.length} className="block">{renderInline(line)}</span>);
      }
    }
  }
  flushList();
  return <>{nodes}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part,
      )}
    </>
  );
}

interface PromptCard {
  id: string;
  title: string;
  price: number;
  model: string;
  creator: string;
  rating: number | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: PromptCard[];
  toolChips?: string[];
  streaming?: boolean;
}

interface ChatWidgetProps {
  open: boolean;
  onClose: () => void;
  mascotKey: MascotKey;
  isAuthed: boolean;
}

export function ChatWidget({ open, onClose, mascotKey, isAuthed }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks whether the greeting has been shown so clearing doesn't re-trigger it
  const greetedRef = useRef(false);
  const mascot = MASCOTS[mascotKey];

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Greet once on first open — never again after that (even after clear)
  useEffect(() => {
    if (open && isAuthed && !greetedRef.current) {
      greetedRef.current = true;
      setMessages([
        {
          role: "assistant",
          content: `Hey! I'm ${mascot.name}. I can help you find prompts, manage your binder, craft better prompts, or answer platform questions. What can I do for you?`,
        },
      ]);
    }
  }, [open, isAuthed, mascot.name]);

  const handleClear = () => {
    // Abort any in-flight request so the previous stream stops writing
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages([]);
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);

    // Append user message + streaming placeholder
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", streaming: true, toolChips: [] },
    ]);

    abortRef.current = new AbortController();

    try {
      // Build history excluding the two messages we just appended (user + placeholder)
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: text }] }),
        signal: abortRef.current.signal,
      });

      if (res.status === 401) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "Please sign in to chat with me!",
            streaming: false,
          };
          return next;
        });
        return;
      }

      if (!res.ok) {
        let errMsg = "Something went wrong. Please try again.";
        try {
          const j = await res.json() as { error?: string };
          if (j.error) errMsg = j.error;
        } catch { /* ignore */ }
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: errMsg,
            streaming: false,
          };
          return next;
        });
        setBusy(false);
        return;
      }

      if (!res.body) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const updateLast = (updater: (msg: Message) => Message) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = updater(next[next.length - 1]);
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          let eventName = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7);
            if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (eventName === "token") {
            updateLast((m) => ({ ...m, content: m.content + (payload.text as string) }));
          } else if (eventName === "intent") {
            // Quick pre-chip emitted immediately so user knows the bot is thinking
            updateLast((m) => ({ ...m, toolChips: [payload.label as string] }));
          } else if (eventName === "tool") {
            updateLast((m) => {
              const existing = m.toolChips ?? [];
              // Replace the single intent pre-chip on first real tool event
              const isOnlyPreChip = existing.length === 1;
              const base = isOnlyPreChip ? [] : existing;
              return { ...m, toolChips: [...base, payload.label as string] };
            });
          } else if (eventName === "cards") {
            updateLast((m) => ({ ...m, cards: payload.cards as PromptCard[] }));
          } else if (eventName === "error") {
            updateLast((m) => ({
              ...m,
              content: m.content || (payload.message as string),
              streaming: false,
            }));
          } else if (eventName === "done") {
            updateLast((m) => ({ ...m, streaming: false }));
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        const isAbort = (err as Error).name === "AbortError";
        next[next.length - 1] = {
          role: "assistant",
          content: isAbort ? "" : "Something went wrong. Please try again.",
          streaming: false,
        };
        return next;
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, busy, messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="chat-widget"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={`fixed right-3 sm:right-6 z-[101] flex flex-col bg-white border-4 border-ink shadow-pop-lg transition-all duration-300 ${expanded ? "bottom-6 w-[min(680px,calc(100vw-24px))] max-h-[88vh]" : "bottom-36 w-[min(420px,calc(100vw-24px))] max-h-[640px]"}`}
          style={{ willChange: "transform, opacity" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b-4 border-ink bg-accent-yellow shrink-0">
            <div className="font-display text-sm uppercase leading-tight">
              Chat with {mascot.name}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={handleClear}
                className="text-xs font-bold text-ink/50 hover:text-ink transition-colors"
                title="Clear chat"
              >
                Clear
              </button>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-sm text-ink/40 hover:text-ink transition-colors leading-none"
                aria-label={expanded ? "Shrink chat" : "Expand chat"}
                title={expanded ? "Shrink" : "Expand"}
              >
                {expanded ? "⊟" : "⊞"}
              </button>
              <button
                onClick={onClose}
                className="text-sm font-bold hover:text-magenta transition-colors"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {!isAuthed ? (
              <div className="text-center py-8">
                <p className="text-sm font-bold text-ink/60 mb-4">Sign in to chat with {mascot.name}</p>
                <Link
                  to="/auth"
                  onClick={onClose}
                  className="inline-block px-4 py-2 bg-magenta text-white font-bold text-sm border-2 border-ink shadow-pop hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
                >
                  Sign In
                </Link>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink/30 text-center">Try asking…</p>
                {[
                  "Find me cyberpunk prompts under 3 credits",
                  "What's trending right now?",
                  "Write a Midjourney prompt for a neon city at night",
                  "How do I earn credits?",
                  "Show me my saved prompts",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium border-2 border-ink/20 hover:border-magenta hover:text-magenta transition-colors bg-white text-ink/70 leading-snug"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  {/* Tool chips */}
                  {msg.role === "assistant" && (msg.toolChips ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {msg.toolChips!.map((chip, j) => (
                        <span
                          key={j}
                          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 bg-accent-yellow border border-ink/30 text-ink/70"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bubble */}
                  {(msg.content || msg.streaming) && (
                    <div
                      className={`max-w-[90%] px-3 py-2 text-sm leading-relaxed border-2 border-ink ${
                        msg.role === "user"
                          ? "bg-magenta text-white"
                          : "bg-white text-ink shadow-[2px_2px_0_0_#0a0a0c]"
                      }`}
                    >
                      {msg.content ? (
                        <>
                          {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                          {msg.streaming && (
                            <span className="inline-block w-[2px] h-[1em] bg-current ml-0.5 align-middle animate-[blink_0.8s_step-end_infinite]" />
                          )}
                        </>
                      ) : (
                        <span className="flex gap-1 items-center h-5">
                          <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                          <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                          <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Prompt cards */}
                  {msg.role === "assistant" && (msg.cards ?? []).length > 0 && (
                    <div className="w-full space-y-1 mt-1">
                      {msg.cards!.slice(0, 4).map((card) => (
                        <Link
                          key={card.id}
                          to="/prompt/$id"
                          params={{ id: card.id }}
                          onClick={onClose}
                          className="flex items-center gap-2 px-3 py-2 border-2 border-ink bg-white hover:bg-accent-yellow transition-colors shadow-[2px_2px_0_0_#0a0a0c] group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs truncate group-hover:text-magenta transition-colors">
                              {card.title}
                            </p>
                            <p className="text-[10px] text-ink/50">{card.model}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display text-sm">{card.price}✦</p>
                            {card.rating != null && (
                              <p className="text-[10px] text-ink/50">★ {card.rating.toFixed(1)}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {isAuthed && (
            <div className="flex gap-0 border-t-4 border-ink shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything…"
                disabled={busy}
                className="flex-1 px-3 py-3 text-sm bg-white text-ink placeholder:text-ink/30 outline-none disabled:opacity-50"
              />
              {busy ? (
                <button
                  onClick={() => {
                    abortRef.current?.abort();
                    abortRef.current = null;
                    setBusy(false);
                    setMessages((prev) => {
                      const next = [...prev];
                      if (next[next.length - 1]?.streaming) {
                        next[next.length - 1] = { ...next[next.length - 1], streaming: false };
                      }
                      return next;
                    });
                  }}
                  className="px-4 py-3 bg-ink text-white font-bold text-sm border-l-4 border-ink hover:bg-magenta transition-colors"
                  aria-label="Stop generating"
                  title="Stop"
                >
                  ⏹
                </button>
              ) : (
                <button
                  onClick={() => void send()}
                  disabled={!input.trim()}
                  className="px-4 py-3 bg-magenta text-white font-bold text-sm border-l-4 border-ink hover:bg-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  →
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
