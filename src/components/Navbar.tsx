import { useEffect, useRef, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CURRENT_USER_QUERY_KEY, getCurrentUser, signOut } from "@/lib/api/auth.functions";
import { CREDITS_QUERY_KEY, getMyCredits } from "@/lib/api/credits.functions";
import { getUnreadCount } from "@/lib/api/notifications.functions";
import { MASCOTS } from "@/lib/mascots";
import { CreditBalanceWidget } from "./CreditBalanceWidget";
import { CreditsModal } from "./CreditsModal";
import { NotificationBell } from "./NotificationBell";

const links = [
  { to: "/", label: "Market", tour: "market" },
  { to: "/explore", label: "Explore", tour: "explore" },
  { to: "/dashboard", label: "Binder", tour: "binder" },
] as const;

export function Navbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

  // Shared across routes via the QueryClient so actions on other pages
  // (e.g. purchasing a prompt) can update this balance instantly via
  // queryClient.setQueryData(CREDITS_QUERY_KEY, ...) without a refetch.
  const { data: creditsData } = useQuery({
    queryKey: CREDITS_QUERY_KEY,
    queryFn: getMyCredits,
    enabled: !!user,
    staleTime: 30_000,
  });
  const creditBalance = creditsData?.balance ?? null;

  useEffect(() => {
    if (!user) return;
    getUnreadCount().then((c) => setUnreadCount(c.count)).catch(() => {});
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
                data-tour={l.tour}
                className={`font-bold uppercase text-sm transition-colors ${
                  active ? "text-magenta" : "text-ink hover:text-magenta"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {user?.is_admin && (
            <Link
              to="/admin"
              className={`font-bold uppercase text-sm transition-colors ${
                pathname.startsWith("/admin") ? "text-magenta" : "text-ink hover:text-magenta"
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 border-2 border-ink font-bold text-lg"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>

        {user ? (
          <div className="hidden md:flex items-center gap-4">
            <NotificationBell unreadCount={unreadCount} onOpened={() => setUnreadCount(0)} />
            <div data-tour="credits" className="flex items-center">
              <CreditBalanceWidget balance={creditBalance} onOpen={() => setCreditsOpen(true)} />
            </div>
            <div ref={menuRef} className="relative">
              <button
                data-tour="studio"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 border-2 border-ink rounded-full pl-1 pr-3 py-1 bg-accent-yellow hover:bg-accent-orange hover:text-white transition-colors"
              >
              <img
                src={user.avatarUrl ?? MASCOTS[user.mascot].image}
                alt=""
                width={32}
                height={32}
                className={`size-8 rounded-full border-2 border-ink bg-white ${
                  user.avatarUrl ? "object-cover" : "object-contain"
                }`}
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
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/auth"
              className="font-bold uppercase text-sm hover:text-magenta transition-colors"
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t-4 border-ink bg-white">
          {links.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-6 py-4 font-bold uppercase text-sm border-b-2 border-ink/10 transition-colors ${
                  active ? "bg-magenta text-white" : "hover:bg-accent-yellow"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {user?.is_admin && (
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className={`block px-6 py-4 font-bold uppercase text-sm border-b-2 border-ink/10 transition-colors ${
                pathname.startsWith("/admin") ? "bg-magenta text-white" : "hover:bg-accent-yellow"
              }`}
            >
              Admin
            </Link>
          )}
          {user ? (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b-2 border-ink/10">
                <span className="font-bold uppercase text-sm">Notifications</span>
                <NotificationBell unreadCount={unreadCount} onOpened={() => setUnreadCount(0)} />
              </div>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-6 py-4 font-bold uppercase text-sm border-b-2 border-ink/10 hover:bg-accent-yellow transition-colors">Studio</Link>
              <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="w-full text-left px-6 py-4 font-bold uppercase text-sm text-magenta hover:bg-ink hover:text-white transition-colors">Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/auth" onClick={() => setMobileOpen(false)} className="block px-6 py-4 font-bold uppercase text-sm border-b-2 border-ink/10 hover:bg-accent-yellow transition-colors">Log In</Link>
              <Link to="/auth" search={{ mode: "signup" }} onClick={() => setMobileOpen(false)} className="block px-6 py-4 font-bold uppercase text-sm bg-accent-orange text-white hover:bg-magenta transition-colors">Join the Verse</Link>
            </>
          )}
        </div>
      )}
    </nav>
    <CreditsModal
      open={creditsOpen}
      onClose={() => setCreditsOpen(false)}
    />
    </>
  );
}
