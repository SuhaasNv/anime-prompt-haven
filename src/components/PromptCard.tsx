import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { Prompt } from "@/lib/mock-data";
import { handleImageError } from "@/lib/utils";

const shadowMap = {
  magenta: "shadow-pop-magenta",
  orange: "shadow-pop-orange",
  yellow: "shadow-pop-yellow",
  purple: "shadow-pop-purple",
  black: "shadow-pop-lg",
} as const;

interface PromptCardProps {
  prompt: Prompt;
  purchased?: boolean;
  currentUserId?: string;
  /**
   * Position in its grid. Used only to stagger the reveal animation
   * (~50ms per item, capped) so a grid cascades in instead of popping
   * all at once. Defaults to 0, leaving existing callers unchanged.
   */
  index?: number;
}

export function PromptCard({
  prompt,
  purchased = false,
  currentUserId,
  index = 0,
}: PromptCardProps) {
  const isOwner = !!currentUserId && prompt.userId === currentUserId;
  const rotate = prompt.rotate === 1 ? "rotate-1" : prompt.rotate === -1 ? "-rotate-1" : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ rotate: -2, scale: 1.02 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 22,
        delay: Math.min(index * 0.05, 0.4),
      }}
      className={`relative bg-white border-2 border-ink/55 p-4 ${shadowMap[prompt.shadow]} ${rotate} hover:drop-shadow-[0_0_18px_rgba(212,0,255,0.45)]`}
    >
      {/* Stretched link covers the whole card; the @creator link below sits
          above it (pointer-events-auto) so it remains independently clickable
          without nesting an <a> inside an <a>. */}
      <Link
        to="/prompt/$id"
        params={{ id: prompt.id }}
        className="absolute inset-0 z-0"
        aria-label={prompt.title}
      />
      <div className="relative pointer-events-none">
        <div className="w-full aspect-[4/3] mb-4 overflow-hidden border-2 border-ink/55 relative bg-ink">
          {/* Blurred, zoomed copy fills the card so any aspect ratio (e.g. 16:9)
              reads as an ambient backdrop instead of being cropped. */}
          <img
            src={prompt.image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl brightness-90"
          />
          {/* The full, uncropped image, centered at its natural aspect ratio. */}
          <img
            src={prompt.image}
            alt={prompt.title}
            loading="lazy"
            width={768}
            height={576}
            className="relative w-full h-full object-contain"
            onError={handleImageError}
          />
          <span className="absolute top-2 left-2 bg-ink text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-widest">
            {prompt.model}
          </span>
        </div>
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="font-bold text-lg leading-tight uppercase">{prompt.title}</h3>
          <span className="bg-accent-yellow px-2 py-1 border-2 border-ink font-display text-xs whitespace-nowrap">
            {prompt.price === 0 ? "FREE" : `${prompt.price} ✦`}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="size-6 rounded-full bg-ink text-white text-xs flex items-center justify-center border border-ink overflow-hidden">
            {prompt.creatorAvatarUrl ? (
              <img src={prompt.creatorAvatarUrl} alt="" className="size-full object-cover" />
            ) : (
              prompt.creatorEmoji
            )}
          </div>
          <Link
            to="/u/$username"
            params={{ username: prompt.creator }}
            className="pointer-events-auto relative z-10 text-xs font-bold text-ink/60 tracking-wider uppercase hover:text-magenta hover:underline"
          >
            @{prompt.creator}
          </Link>
          <span className="ml-auto text-xs font-bold text-accent-orange">
            ★ {prompt.rating.toFixed(1)}
          </span>
        </div>
        {isOwner ? (
          <div className="w-full bg-holo-purple text-white py-3 font-bold uppercase text-center hover:bg-magenta transition-colors text-sm">
            Manage Prompt
          </div>
        ) : prompt.price > 0 && purchased ? (
          <div className="w-full bg-green-600 text-white py-3 font-bold uppercase text-center text-sm">
            ✓ Already Bought
          </div>
        ) : (
          <div className="w-full bg-ink text-white py-3 font-bold uppercase text-center hover:bg-magenta transition-colors text-sm">
            {prompt.price === 0 ? "Copy Prompt" : "View Prompt"}
          </div>
        )}
      </div>
    </motion.div>
  );
}
