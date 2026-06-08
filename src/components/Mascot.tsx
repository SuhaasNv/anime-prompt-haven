import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/api/auth.functions";
import { MASCOT_TIPS } from "@/lib/mock-data";
import { MASCOTS, type MascotKey } from "@/lib/mascots";

export function Mascot() {
  const [open, setOpen] = useState(true);
  const [mascotKey, setMascotKey] = useState<MascotKey>("nova");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tip = MASCOT_TIPS[pathname] ?? MASCOT_TIPS.default;

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((user) => {
      if (!cancelled && user) setMascotKey(user.mascot);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const active = MASCOTS[mascotKey];

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {open && (
          <motion.div
            key={tip}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="pointer-events-auto relative max-w-[220px] bg-white border-2 border-ink rounded-xl p-3 shadow-pop"
          >
            <p className="text-xs font-bold uppercase leading-tight italic text-ink">{tip}</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Dismiss tip"
              className="absolute -top-2 -right-2 size-6 bg-accent-yellow border-2 border-ink rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-accent-orange transition-colors"
            >
              ×
            </button>
            <div className="absolute -bottom-[10px] right-8 w-4 h-4 bg-white border-r-2 border-b-2 border-ink rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.08, rotate: -4 }}
        whileTap={{ scale: 0.92 }}
        animate={{ y: [0, -8, 0] }}
        transition={{ y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" } }}
        aria-label="Toggle mascot tip"
        className="pointer-events-auto relative size-24"
      >
        <div className="absolute inset-0 bg-magenta/40 blur-2xl rounded-full" />
        <AnimatePresence mode="wait">
          <motion.img
            key={mascotKey}
            src={active.image}
            alt={`${active.name} mascot`}
            width={96}
            height={96}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 size-24 drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
          />
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
