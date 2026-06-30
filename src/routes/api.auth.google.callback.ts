import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { buildSessionSetCookie, createSessionToken } from "@/lib/auth.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  buildClearCookie,
  findOrCreateGoogleUser,
  readCookie,
  redirectUriFromRequest,
  resolveGoogleIdentity,
} from "@/lib/google-oauth.server";

// GET /api/auth/google/callback — finish the Google OAuth flow.
// Verifies state (CSRF) against the cookie, exchanges the code with the PKCE
// verifier, resolves the verified Google identity, finds-or-creates the user,
// issues a session, and clears the temp cookies.
export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const isProd = process.env.NODE_ENV === "production";
        const fail = (reason: string) =>
          new Response(null, { status: 302, headers: { Location: `/auth?error=${reason}` } });

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (url.searchParams.get("error") || !code || !state) return fail("google_denied");

        // CSRF: the state echoed back by Google must match the one we set.
        const cookieState = readCookie(request, OAUTH_STATE_COOKIE);
        const verifier = readCookie(request, OAUTH_VERIFIER_COOKIE);
        if (!cookieState || !verifier || cookieState !== state) return fail("google_state");

        // Rate-limit per client IP so new-account welcome bonuses can't be farmed
        // and the token endpoint can't be hammered. Mirrors the password sign-in limit.
        const clientIp =
          (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
        try {
          checkRateLimit(`oauth:google:${clientIp}`, 10, 15 * 60 * 1000);
        } catch {
          return fail("google_rate");
        }

        try {
          const identity = await resolveGoogleIdentity(code, verifier, redirectUriFromRequest(request));
          const userId = await findOrCreateGoogleUser(identity);
          const { token, expiresAt } = await createSessionToken(userId);

          const headers = new Headers({ Location: "/dashboard" });
          headers.append("Set-Cookie", buildSessionSetCookie(token, expiresAt));
          headers.append("Set-Cookie", buildClearCookie(OAUTH_STATE_COOKIE, isProd));
          headers.append("Set-Cookie", buildClearCookie(OAUTH_VERIFIER_COOKIE, isProd));
          return new Response(null, { status: 302, headers });
        } catch (err) {
          console.error("[google-oauth] callback failed:", err);
          return fail("google_failed");
        }
      },
    },
  },
});
