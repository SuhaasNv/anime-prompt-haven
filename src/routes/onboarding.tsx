import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";

import {
  CURRENT_USER_QUERY_KEY,
  completeOnboarding,
  getCurrentUser,
} from "@/lib/api/auth.functions";
import { MASCOTS, type MascotKey } from "@/lib/mascots";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: getCurrentUser,
      staleTime: 60_000,
    });
    if (!user) {
      throw redirect({ to: "/auth" });
    }
    // Already set up (password sign-ups, returning users) — skip onboarding.
    if (user.onboarded) {
      throw redirect({ to: user.is_admin ? "/admin" : "/dashboard" });
    }
    return { user };
  },
  head: () => ({
    meta: [
      { title: "Welcome — PromptStar" },
      { name: "description", content: "Set up your PromptStar profile." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState(user.username);
  const [mascotChoice, setMascotChoice] = useState<MascotKey>(
    (user.mascot as MascotKey) ?? "nova",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await completeOnboarding({ data: { username, mascot: mascotChoice } });
      // Refresh the cached session so the dashboard's beforeLoad sees onboarded=true.
      const fresh = await getCurrentUser();
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, fresh);
      await router.navigate({ to: fresh?.is_admin ? "/admin" : "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden">
      <div className="max-w-lg w-full bg-white border-4 border-ink p-8 shadow-pop-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-ink/60">Welcome aboard</p>
        <h1 className="font-display text-4xl uppercase mt-2 leading-none">
          Let's set you up, {user.username.split(" ")[0]}!
        </h1>
        <p className="text-ink/70 mt-2 mb-6 text-sm font-medium">
          Pick a handle and your companion to finish creating your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={2}
              maxLength={40}
              required
              className="w-full bg-white border-2 border-ink p-3 font-bold focus:outline-none focus:ring-4 focus:ring-magenta/30"
            />
          </div>

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

          {error && <p className="text-xs font-bold text-magenta">{error}</p>}

          <motion.button
            type="submit"
            disabled={submitting}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          >
            {submitting ? "Setting up…" : "Enter PromptStar"}
          </motion.button>
        </form>
      </div>
    </div>
  );
}
