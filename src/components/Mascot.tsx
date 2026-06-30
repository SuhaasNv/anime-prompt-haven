import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/api/auth.functions";
import { MASCOT_TIPS } from "@/lib/mock-data";
import { MASCOTS, type MascotKey } from "@/lib/mascots";
import { ChatWidget } from "@/components/ChatWidget";

export function Mascot() {
  const [tipOpen, setTipOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [mascotKey, setMascotKey] = useState<MascotKey>("nova");
  const [isAuthed, setIsAuthed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tip = MASCOT_TIPS[pathname] ?? MASCOT_TIPS.default;

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((user) => {
      if (cancelled) return;
      if (user) {
        setMascotKey(user.mascot as MascotKey);
        setIsAuthed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const active = MASCOTS[mascotKey];

  const handleMascotClick = () => {
    setTipOpen(false);
    setChatOpen((o) => !o);
  };

  return (
    <>
      <ChatWidget
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        mascotKey={mascotKey}
        isAuthed={isAuthed}
      />

      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {tipOpen && !chatOpen && (
            <motion.div
              key={tip}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="pointer-events-auto relative max-w-[220px] bg-white border-2 border-ink rounded-xl p-3 shadow-pop"
            >
              <p className="text-xs font-bold uppercase leading-tight italic text-ink">{tip}</p>
              <p className="text-[10px] text-magenta font-bold mt-1 not-italic">👋 I'm here — click to chat!</p>
              <button
                onClick={() => setTipOpen(false)}
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
          onClick={handleMascotClick}
          whileHover={{ scale: 1.08, rotate: -4 }}
          whileTap={{ scale: 0.92 }}
          animate={{ y: [0, -8, 0] }}
          transition={{ y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" } }}
          aria-label={`Chat with ${active.name}`}
          data-tour="mascot-chat"
          className="pointer-events-auto relative size-24"
        >
          <div
            className={`absolute inset-0 blur-2xl rounded-full transition-colors duration-300 ${chatOpen ? "bg-magenta/60" : "bg-magenta/40"}`}
          />
          {/* Attention ring — pulses until the user opens chat for the first time */}
          {tipOpen && !chatOpen && (
            <span className="absolute inset-0 rounded-full border-2 border-magenta animate-ping opacity-60 pointer-events-none" />
          )}
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
          {chatOpen && (
            <span className="absolute -top-1 -right-1 size-4 bg-magenta rounded-full border-2 border-ink z-20" />
          )}
        </motion.button>
      </div>
    </>
  );
}
