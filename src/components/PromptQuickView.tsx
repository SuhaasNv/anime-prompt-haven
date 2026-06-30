import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Maximize2, X, Plus } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContainer,
  DialogContent,
  DialogClose,
  DialogImage,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/linear-card";
import type { Prompt } from "@/lib/mock-data";
import { handleImageError } from "@/lib/utils";

const shadowMap = {
  magenta: "shadow-pop-magenta",
  orange: "shadow-pop-orange",
  yellow: "shadow-pop-yellow",
  purple: "shadow-pop-purple",
  black: "shadow-pop-lg",
} as const;

interface PromptQuickViewProps {
  prompt: Prompt;
  purchased?: boolean;
  currentUserId?: string;
  /** Position in the grid — staggers the entrance reveal (~50ms/item, capped). */
  index?: number;
}

/**
 * Marketplace card that smoothly "pops out" into a quick-preview on click
 * (shared-layout morph via the linear-card Dialog primitives), with a
 * maximize button for a full-screen image lightbox. The preview's primary
 * CTA routes to the real /prompt/$id detail page, so the buy/reviews flow
 * and paid-body gating are never bypassed. Used on the landing page only;
 * other pages keep the simpler navigating PromptCard.
 */
export function PromptQuickView({
  prompt,
  purchased = false,
  currentUserId,
  index = 0,
}: PromptQuickViewProps) {
  const isOwner = !!currentUserId && prompt.userId === currentUserId;
  const rotate = prompt.rotate === 1 ? "rotate-1" : prompt.rotate === -1 ? "-rotate-1" : "";
  const reduceMotion = useReducedMotion();
  const [maximized, setMaximized] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc closes the full-screen lightbox.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximized(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [maximized]);

  const cta = isOwner ? "Manage Prompt" : prompt.price === 0 ? "Copy Prompt" : "View Prompt";

  return (
    // Entrance/stagger reveal lives on an outer wrapper so it never competes
    // with the trigger's shared-layout (layoutId) pop-out animation.
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.05, 0.4) }}
    >
      <Dialog
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 26, mass: 0.6 }
        }
      >
        <DialogTrigger
          className={`block bg-white border-2 border-ink/55 p-4 ${shadowMap[prompt.shadow]} ${rotate} hover:drop-shadow-[0_0_18px_rgba(212,0,255,0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-magenta/40`}
        >
          <div className="w-full aspect-[4/3] mb-4 overflow-hidden border-2 border-ink/55 relative bg-ink">
            <img
              src={prompt.image}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl brightness-90"
            />
            <DialogImage
              src={prompt.image}
              alt={prompt.title}
              className="relative w-full h-full object-contain"
            />
            <span className="absolute top-2 left-2 bg-ink text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-widest">
              {prompt.model}
            </span>
            <span className="absolute bottom-2 right-2 grid place-items-center size-8 bg-magenta text-white border-2 border-ink">
              <Plus aria-hidden="true" strokeWidth={3} className="size-4" />
            </span>
          </div>
          <div className="flex justify-between items-start mb-2 gap-2">
            <DialogTitle className="font-bold text-lg leading-tight uppercase">
              {prompt.title}
            </DialogTitle>
            <span className="bg-accent-yellow px-2 py-1 border-2 border-ink font-display text-xs whitespace-nowrap">
              {prompt.price === 0 ? "FREE" : `${prompt.price} ✦`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-ink text-white text-xs flex items-center justify-center border border-ink overflow-hidden">
              {prompt.creatorAvatarUrl ? (
                <img src={prompt.creatorAvatarUrl} alt="" className="size-full object-cover" />
              ) : (
                prompt.creatorEmoji
              )}
            </div>
            <span className="text-xs font-bold text-ink/60 tracking-wider uppercase">
              @{prompt.creator}
            </span>
            <span className="ml-auto text-xs font-bold text-accent-orange">
              ★ {prompt.rating.toFixed(1)}
            </span>
          </div>
        </DialogTrigger>

        <DialogContainer className="flex items-start justify-center p-4 pt-20">
          <DialogContent className="relative flex flex-col w-[92vw] max-w-3xl max-h-[88dvh] overflow-y-auto bg-white border-4 border-ink/55 shadow-pop-magenta">
            <div className="relative aspect-[4/3] bg-ink border-b-4 border-ink/55">
              <img
                src={prompt.image}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-90"
              />
              <DialogImage
                src={prompt.image}
                alt={prompt.title}
                className="relative w-full h-full object-contain"
              />
              <span className="absolute top-3 left-3 bg-ink text-white text-[10px] font-bold uppercase px-2 py-1 tracking-widest">
                {prompt.model}
              </span>
              <button
                type="button"
                onClick={() => setMaximized(true)}
                aria-label="View image full screen"
                className="absolute bottom-3 right-3 grid place-items-center size-10 bg-white text-ink border-2 border-ink cursor-pointer hover:bg-accent-yellow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-magenta/40 transition-colors"
              >
                <Maximize2 aria-hidden="true" strokeWidth={2.5} className="size-5" />
              </button>
            </div>

            <div className="p-6">
              <DialogTitle className="font-display text-3xl md:text-4xl uppercase leading-[0.95]">
                {prompt.title}
              </DialogTitle>
              <div className="flex items-center flex-wrap gap-3 mt-3">
                <Link
                  to="/u/$username"
                  params={{ username: prompt.creator }}
                  className="text-xs font-bold text-ink/60 tracking-wider uppercase hover:text-magenta hover:underline"
                >
                  @{prompt.creator}
                </Link>
                <span className="text-xs font-bold text-accent-orange">
                  ★ {prompt.rating.toFixed(1)} ({prompt.reviews})
                </span>
                <span className="ml-auto bg-accent-yellow px-3 py-1 border-2 border-ink font-display text-sm whitespace-nowrap">
                  {prompt.price === 0 ? "FREE" : `${prompt.price} ✦`}
                </span>
              </div>

              <DialogDescription
                disableLayoutAnimation
                variants={{
                  initial: { opacity: 0, y: 16 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: 12 },
                }}
              >
                <p className="mt-4 text-sm text-ink/70 font-medium leading-relaxed">
                  {prompt.description}
                </p>
                {prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {prompt.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 font-bold rounded-full text-[11px] border-2 border-ink bg-white text-ink"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </DialogDescription>

              <Link
                to="/prompt/$id"
                params={{ id: prompt.id }}
                className="block text-center w-full mt-6 py-3 bg-ink text-white font-bold uppercase hover:bg-magenta transition-colors text-sm border-2 border-ink"
              >
                {cta}
              </Link>
            </div>

            <DialogClose className="size-9 grid place-items-center bg-white text-ink border-2 border-ink cursor-pointer hover:bg-magenta hover:text-white transition-colors">
              <X aria-hidden="true" strokeWidth={3} className="size-5" />
            </DialogClose>
          </DialogContent>
        </DialogContainer>
      </Dialog>

      {/* Full-screen image lightbox — portaled to <body> and layered above the
          preview dialog (z-110 > dialog z-100) so it's a true full-page view. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {maximized && (
              <motion.div
                className="fixed inset-0 z-[110] bg-ink/95 flex items-center justify-center p-4 cursor-zoom-out"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMaximized(false)}
                role="dialog"
                aria-modal="true"
                aria-label={`${prompt.title} — full screen`}
              >
                <motion.img
                  src={prompt.image}
                  alt={prompt.title}
                  onError={handleImageError}
                  className="max-h-full max-w-full object-contain border-4 border-white"
                  initial={{ scale: reduceMotion ? 1 : 0.92 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: reduceMotion ? 1 : 0.95 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={() => setMaximized(false)}
                  aria-label="Close full screen"
                  className="absolute top-4 right-4 size-11 grid place-items-center bg-white text-ink border-2 border-ink cursor-pointer hover:bg-magenta hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-magenta/40 transition-colors"
                >
                  <X aria-hidden="true" strokeWidth={3} className="size-6" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </motion.div>
  );
}
