import { Link, useRouterState } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Market" },
  { to: "/dashboard", label: "Binder" },
  { to: "/profile", label: "Studio" },
] as const;

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
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

        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="hidden sm:inline font-bold uppercase text-sm hover:text-magenta transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="bg-accent-orange text-white px-5 py-2 font-display uppercase tracking-wide border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            Enter
          </Link>
        </div>
      </div>
    </nav>
  );
}
