import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { signIn, signUp } from "@/lib/api/auth.functions";
import { MASCOTS, type MascotKey } from "@/lib/mascots";

// Nova-chan only ships one piece of art, so each "mood" restyles that single
// frame — tilt, squash/stretch, and a colour-graded filter — to read as a
// distinct expression rather than stamping a generic emoji over it.
const MOODS = [
  {
    name: "Sparkle Mode",
    chip: "bg-magenta text-white",
    glow: "bg-magenta/35",
    filter: "saturate(1.35) brightness(1.04)",
    rotate: -7,
    scaleX: 1,
    scaleY: 1,
  },
  {
    name: "Hyped Up",
    chip: "bg-accent-orange text-white",
    glow: "bg-accent-orange/35",
    filter: "saturate(1.5) contrast(1.12)",
    rotate: 5,
    scaleX: 1.05,
    scaleY: 0.96,
  },
  {
    name: "Chill Vibes",
    chip: "bg-holo-purple text-white",
    glow: "bg-holo-purple/35",
    filter: "hue-rotate(-14deg) brightness(0.97) saturate(0.95)",
    rotate: -3,
    scaleX: 0.97,
    scaleY: 1.03,
  },
  {
    name: "Easy Peasy",
    chip: "bg-accent-yellow text-ink border border-ink",
    glow: "bg-accent-yellow/40",
    filter: "saturate(1.2) brightness(1.08)",
    rotate: 7,
    scaleX: 1.03,
    scaleY: 0.98,
  },
  {
    name: "S-Rank Energy",
    chip: "bg-magenta text-white",
    glow: "bg-magenta/35",
    filter: "contrast(1.18) saturate(1.45)",
    rotate: -5,
    scaleX: 1.04,
    scaleY: 0.97,
  },
] as const;

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
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [exprIndex, setExprIndex] = useState(0);
  const [mascotChoice, setMascotChoice] = useState<MascotKey>("nova");
  const focused = email.length > 0 || password.length > 0;

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setExprIndex((i) => (i + 1) % MOODS.length);
    }, 2600);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp({ data: { email, username, password, mascot: mascotChoice } });
      } else {
        await signIn({ data: { email, password, rememberMe } });
      }
      await router.invalidate();
      await router.navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const mood = MOODS[exprIndex];

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden">
      {!reduceMotion && (
        <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
          <motion.div
            className="absolute -top-20 -left-20 size-72 rounded-full bg-magenta/20 blur-3xl"
            style={{ willChange: "transform" }}
            animate={{ y: [0, 26, 0], x: [0, 18, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 -right-24 size-80 rounded-full bg-holo-purple/20 blur-3xl"
            style={{ willChange: "transform" }}
            animate={{ y: [0, -30, 0], x: [0, -20, 0] }}
            transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-16 left-1/4 size-64 rounded-full bg-accent-yellow/20 blur-3xl"
            style={{ willChange: "transform" }}
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          {(["✨", "⭐", "💫", "🌟"] as const).map((s, i) => (
            <motion.span
              key={s}
              className="absolute text-3xl select-none"
              style={{
                top: `${14 + i * 22}%`,
                left: i % 2 === 0 ? "6%" : "90%",
                willChange: "transform, opacity",
              }}
              animate={{ y: [0, -16, 0], opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            >
              {s}
            </motion.span>
          ))}
        </div>
      )}

      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Mascot side */}
        <div className="hidden md:flex flex-col items-center text-center relative">
          <div className="relative">
            {/* Mood-tinted aura — recolours per cycle to sell the mood shift */}
            <motion.div
              key={"glow" + mood.name}
              className={`absolute inset-8 rounded-full blur-3xl transition-colors duration-700 ${mood.glow}`}
              animate={reduceMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="relative"
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: [0, -12, 0],
                      rotate: focused ? [-3, 3, -3] : mood.rotate,
                      scaleX: mood.scaleX,
                      scaleY: mood.scaleY,
                    }
              }
              transition={{
                y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                rotate: { type: "spring", stiffness: 90, damping: 12 },
                scaleX: { type: "spring", stiffness: 90, damping: 12 },
                scaleY: { type: "spring", stiffness: 90, damping: 12 },
              }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={mascotChoice}
                  src={MASCOTS[mascotChoice].image}
                  alt={`${MASCOTS[mascotChoice].name} mascot`}
                  width={280}
                  height={280}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.25 }}
                  className="relative z-10 size-72 drop-shadow-[6px_6px_0_#0a0a0c] transition-[filter] duration-700 ease-out"
                  style={{ filter: reduceMotion ? undefined : mood.filter }}
                />
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Mood chip — names the expression in words instead of a stock emoji face */}
          <AnimatePresence mode="wait">
            <motion.span
              key={mood.name}
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className={`mt-3 inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] border-2 border-ink shadow-pop ${mood.chip}`}
            >
              ◆ {mood.name}
            </motion.span>
          </AnimatePresence>

          <motion.div
            className="relative bg-white border-2 border-ink p-4 shadow-pop max-w-xs mt-4"
            animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
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
          </motion.div>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="senpai_99"
                  className="w-full bg-white border-2 border-ink p-3 font-bold focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@multiverse.io"
                className="w-full bg-white border-2 border-ink p-3 font-bold focus:outline-none focus:ring-4 focus:ring-magenta/30"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border-2 border-ink p-3 pr-12 font-bold focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center text-xl hover:scale-110 transition-transform"
                >
                  <motion.span
                    key={String(showPassword)}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    className="inline-block"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </motion.span>
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <span className="text-xs font-bold uppercase tracking-widest block mb-2">Pick your companion</span>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(MASCOTS) as MascotKey[]).map((key) => {
                    const m = MASCOTS[key];
                    const selected = mascotChoice === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMascotChoice(key)}
                        aria-pressed={selected}
                        className={`flex flex-col items-center gap-1 p-3 border-2 transition-all ${
                          selected
                            ? "border-ink bg-accent-yellow shadow-[4px_4px_0_0_#0a0a0c] -translate-x-0.5 -translate-y-0.5"
                            : "border-ink/30 bg-white hover:border-ink"
                        }`}
                      >
                        <img src={m.image} alt={m.name} width={64} height={64} className="size-16 object-contain" />
                        <span className="font-display uppercase text-sm leading-none">{m.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink/50">{m.tagline}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-xs font-bold text-magenta">{error}</p>}

            {mode === "signin" && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase tracking-widest select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="size-5 border-2 border-ink bg-white peer-checked:bg-accent-yellow flex items-center justify-center transition-colors">
                  {rememberMe && "✓"}
                </span>
                Remember me — power-up activated
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {submitting ? "One sec…" : mode === "signin" ? "Sign In" : "Create Account"}
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
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
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
