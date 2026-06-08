import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mascot from "@/assets/mascot-wave.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PromptStar" },
      { name: "description", content: "Sign in to your PromptStar account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const focused = email.length > 0 || password.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Mascot side */}
        <div className="hidden md:flex flex-col items-center text-center relative">
          <motion.div
            animate={{ y: [0, -12, 0], rotate: focused ? [-3, 3, -3] : 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <img src={mascot} alt="Nova-chan mascot" width={280} height={280} className="size-72 drop-shadow-[6px_6px_0_#0a0a0c]" />
          </motion.div>
          <div className="relative bg-white border-2 border-ink p-4 shadow-pop max-w-xs mt-4">
            <AnimatePresence mode="wait">
              <motion.p
                key={mode + String(focused)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="font-display uppercase text-lg leading-tight"
              >
                {mode === "signin"
                  ? focused ? "Yes! Keep going, Senpai!" : "Welcome back, Senpai!"
                  : focused ? "Almost there — you got this!" : "Let's start your journey!"}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white border-4 border-ink p-8 shadow-pop-lg">
          <Link to="/" className="text-xs font-bold uppercase tracking-widest text-ink/60 hover:text-magenta">
            ← PromptStar
          </Link>
          <h1 className="font-display text-5xl uppercase mt-2 leading-none">
            {mode === "signin" ? "Power Up" : "Join Guild"}
          </h1>
          <p className="text-ink/70 mt-2 mb-6 text-sm font-medium">
            {mode === "signin" ? "Sign in to access your binder." : "Create an account to start collecting."}
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); alert("Demo only — backend not wired yet."); }}
            className="space-y-4"
          >
            {mode === "signup" && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Username</label>
                <input
                  type="text"
                  placeholder="senpai_99"
                  className="w-full bg-white border-2 border-ink p-3 font-bold focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@multiverse.io"
                className="w-full bg-white border-2 border-ink p-3 font-bold focus:outline-none focus:ring-4 focus:ring-magenta/30"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border-2 border-ink p-3 font-bold focus:outline-none focus:ring-4 focus:ring-magenta/30"
              />
            </div>

            {mode === "signin" && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase tracking-widest">
                <span className="size-5 border-2 border-ink bg-accent-yellow flex items-center justify-center">✓</span>
                Remember me — power-up activated
              </label>
            )}

            <button
              type="submit"
              className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-ink/40">
            <div className="flex-1 h-0.5 bg-ink/20" />
            OR
            <div className="flex-1 h-0.5 bg-ink/20" />
          </div>

          <button className="w-full bg-white text-ink py-3 font-bold uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors">
            Continue with Google
          </button>

          <p className="text-center mt-6 text-sm">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-bold text-magenta underline underline-offset-4"
            >
              {mode === "signin" ? "Join the guild" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
