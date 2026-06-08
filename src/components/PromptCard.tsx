import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { Prompt } from "@/lib/mock-data";

const shadowMap = {
  magenta: "shadow-pop-magenta",
  orange: "shadow-pop-orange",
  yellow: "shadow-pop-yellow",
  purple: "shadow-pop-purple",
  black: "shadow-pop-lg",
} as const;

export function PromptCard({ prompt }: { prompt: Prompt }) {
  const rotate = prompt.rotate === 1 ? "rotate-1" : prompt.rotate === -1 ? "-rotate-1" : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ rotate: -2, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`bg-white border-2 border-ink p-4 ${shadowMap[prompt.shadow]} ${rotate} hover:drop-shadow-[0_0_18px_rgba(212,0,255,0.45)]`}
    >
      <Link to="/prompt/$id" params={{ id: prompt.id }} className="block">
        <div className="w-full aspect-[4/3] mb-4 overflow-hidden border-2 border-ink relative bg-ink">
          <img
            src={prompt.image}
            alt={prompt.title}
            loading="lazy"
            width={768}
            height={576}
            className="w-full h-full object-cover"
          />
          <span className="absolute top-2 left-2 bg-ink text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-widest">
            {prompt.model}
          </span>
        </div>
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="font-bold text-lg leading-tight uppercase">{prompt.title}</h3>
          <span className="bg-accent-yellow px-2 py-1 border-2 border-ink font-display text-xs whitespace-nowrap">
            {prompt.price === 0 ? "FREE" : `$${prompt.price}`}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="size-6 rounded-full bg-ink text-white text-xs flex items-center justify-center border border-ink">
            {prompt.creatorEmoji}
          </div>
          <span className="text-xs font-bold text-ink/60 tracking-wider uppercase">@{prompt.creator}</span>
          <span className="ml-auto text-xs font-bold text-accent-orange">★ {prompt.rating.toFixed(1)}</span>
        </div>
        <div className="w-full bg-ink text-white py-3 font-bold uppercase text-center hover:bg-magenta transition-colors text-sm">
          {prompt.price === 0 ? "Copy Prompt" : "View Prompt"}
        </div>
      </Link>
    </motion.div>
  );
}
