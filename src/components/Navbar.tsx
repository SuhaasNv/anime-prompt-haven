import { useEffect, useRef, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CURRENT_USER_QUERY_KEY, getCurrentUser, signOut } from "@/lib/api/auth.functions";
import { getMyCredits } from "@/lib/api/credits.functions";
import { MASCOTS } from "@/lib/mascots";
import { CreditBalanceWidget } from "./CreditBalanceWidget";
import { CreditsModal } from "./CreditsModal";

const links = [
  { to: "/", label: "Market" },
  { to: "/dashboard", label: "Binder" },
] as const;

export function Navbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cached under a stable key in the app-wide QueryClient (which outlives any
  // single page) so navigating between routes — which remounts the Navbar —
  // reuses the cached session instead of starting from `null` and briefly
  // flashing the signed-out state before the fetch resolves. The full
  // `SessionUser` is cached (not trimmed) so route `beforeLoad` guards can
  // share this exact entry via `ensureQueryData` instead of re-fetching.
  const { data: user } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    getMyCredits().then((c) => setCreditBalance(c.balance)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
      setMenuOpen(false);
      await router.invalidate();
      await router.navigate({ to: "/" });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b-4 border-ink">
      <div className="px-6 md:px-12 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="size-10 bg-ink flex items-center justify-center rotate-3 group-hover:rotate-[-3deg] transition-transform">
            <span className="font-display text-magenta text-2xl leading-none">P!</span>
          </div>
          <span className="font-display text-2xl tracking-tighter uppercase">PromptStar</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`font-bold uppercase text-sm transition-colors ${
                  active ? "text-magenta" : "text-ink hover:text-magenta"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <CreditBalanceWidget balance={creditBalance} onOpen={() => setCreditsOpen(true)} />
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 border-2 border-ink rounded-full pl-1 pr-3 py-1 bg-accent-yellow hover:bg-accent-orange hover:text-white transition-colors"
              >
              <img
                src={MASCOTS[user.mascot].image}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-full border-2 border-ink object-contain bg-white"
              />
              <span className="font-bold uppercase text-xs">@{user.username}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border-2 border-ink shadow-pop overflow-hidden">
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 font-bold uppercase text-xs text-ink hover:bg-accent-yellow transition-colors border-b-2 border-ink"
                >
                  Studio
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full text-left px-4 py-3 font-bold uppercase text-xs text-magenta hover:bg-ink hover:text-white transition-colors disabled:opacity-50"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="hidden sm:inline font-bold uppercase text-sm hover:text-magenta transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="bg-accent-orange text-white px-5 py-2 font-display uppercase tracking-wide border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              Join the Verse
            </Link>
          </div>
        )}
      </div>
    </nav>
    <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} onBalanceChange={setCreditBalance} />
    </>
  );
}
