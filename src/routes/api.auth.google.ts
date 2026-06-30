import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  buildAuthorizationUrl,
  buildTempSetCookie,
  generatePkce,
  generateState,
  getGoogleConfig,
  redirectUriFromRequest,
} from "@/lib/google-oauth.server";

// GET /api/auth/google — start the Google OAuth flow.
// Generates CSRF state + a PKCE verifier, stashes them in short-lived Lax
// cookies, and redirects the browser to Google's consent screen.
export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          getGoogleConfig(); // fail fast if SSO isn't configured
        } catch {
          return new Response(null, { status: 302, headers: { Location: "/auth?error=google_unavailable" } });
        }

        const state = generateState();
        const { verifier, challenge } = generatePkce();
        const redirectUri = redirectUriFromRequest(request);
        const isProd = process.env.NODE_ENV === "production";

        const headers = new Headers({ Location: buildAuthorizationUrl({ redirectUri, state, challenge }) });
        headers.append("Set-Cookie", buildTempSetCookie(OAUTH_STATE_COOKIE, state, isProd));
        headers.append("Set-Cookie", buildTempSetCookie(OAUTH_VERIFIER_COOKIE, verifier, isProd));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
