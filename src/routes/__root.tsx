import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Mascot } from "@/components/Mascot";
import { HoloBackground } from "@/components/HoloBackground";
import { ACCENT_THEMES, ACCENT_THEME_STORAGE_KEY, applyAccentTheme, getStoredAccentTheme } from "@/lib/theme";

// Runs as a blocking inline script before the page paints, so a saved accent
// theme takes effect immediately on a hard refresh — without it, the React
// effect in RootComponent only fires post-hydration, producing a visible
// flash of the default magenta first. Built from the same constants `theme.ts`
// uses (JSON-encoded, no user input) so the two can't drift out of sync.
const THEME_BOOT_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  ACCENT_THEME_STORAGE_KEY,
)});var t=${JSON.stringify(ACCENT_THEMES)};if(v&&t[v])document.documentElement.style.setProperty('--magenta',t[v].hex);}catch(e){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-[10rem] leading-none text-magenta">404</h1>
        <h2 className="mt-2 font-display text-3xl uppercase">Page not found</h2>
        <p className="mt-3 text-sm text-ink/70">
          That prompt has vanished into the multiverse.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block bg-accent-orange text-white px-6 py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          Back to Market
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl uppercase text-ink">Something glitched</h1>
        <p className="mt-2 text-sm text-ink/70">
          The holo-stream got tangled. Try again?
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="bg-magenta text-white px-5 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            Retry
          </button>
          <a
            href="/"
            className="bg-white text-ink px-5 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PromptStar — AI Image Prompt Marketplace" },
      { name: "description", content: "Browse, save, and collect AI image-generation prompts across every style and model. Pop idol holo aesthetic." },
      { property: "og:title", content: "PromptStar — AI Image Prompt Marketplace" },
      { property: "og:description", content: "Browse, save, and collect AI image-generation prompts across every style and model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// suppressHydrationWarning on <html>: THEME_BOOT_SCRIPT sets a `style`
// attribute on this element before hydration so the saved accent theme
// paints immediately — React would otherwise flag that as a mismatch.
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Re-apply the saved accent theme on every full page load — the CSS custom
  // property lives only in the DOM, so SSR always starts from the default.
  useEffect(() => {
    applyAccentTheme(getStoredAccentTheme());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HoloBackground />
      <Outlet />
      <Mascot />
    </QueryClientProvider>
  );
}
