import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { CURRENT_USER_QUERY_KEY, getCurrentUser, signIn, signUp } from "@/lib/api/auth.functions";
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
  // `mode` is optional so links can navigate to "/auth" without specifying it
  // (defaults to sign-in); only the signup CTA passes `mode: "signup"`.
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: "signin" | "signup"; error?: string } => ({
    mode: search.mode === "signup" ? "signup" : "signin",
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — PromptStar" },
      { name: "description", content: "Sign in to your PromptStar account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_unavailable: "Google sign-in isn't available right now.",
  google_denied: "Google sign-in was cancelled.",
  google_state: "Google sign-in expired or was invalid. Please try again.",
  google_rate: "Too many sign-in attempts. Please wait a few minutes and try again.",
  google_failed: "Couldn't complete Google sign-in. Please try again.",
};

function AuthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const { mode: initialMode, error: oauthErrorCode } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthErrorCode ? (OAUTH_ERROR_MESSAGES[oauthErrorCode] ?? "Google sign-in failed. Please try again.") : null,
  );
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
      // Fetch the fresh user from the server now that the session cookie is set,
      // then write it directly into the cache. This eliminates the race where
      // the dashboard's beforeLoad sees a stale/null entry and redirects back.
      const user = await getCurrentUser();
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
      await router.navigate({ to: user?.is_admin ? "/admin" : "/dashboard" });
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
                // Springs only support two keyframes — the focused "wobble" is
                // a three-point [-3, 3, -3] sequence, so it needs a tween-based
                // repeat instead (the single-value mood rotation keeps its spring).
                rotate: focused
                  ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                  : { type: "spring", stiffness: 90, damping: 12 },
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
                  ? focused ? "Yes! Keep going, Star!" : "Welcome back, Star!"
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
                  placeholder="nova_star_99"
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

          <a
            href="/api/auth/google"
            className="w-full flex items-center justify-center gap-2 bg-white text-ink py-3 font-bold uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
            </svg>
            {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
          </a>

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
