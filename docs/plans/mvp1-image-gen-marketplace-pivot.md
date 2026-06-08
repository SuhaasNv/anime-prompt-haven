# PromptStar: Pivot from Anime-Only → General Image-Generation Prompt Marketplace (MVP1)

## Context

PromptStar currently markets itself as an *anime* AI-prompt marketplace ("Anime AI Prompt Marketplace", hero copy "Hyperrealistic anime prompts", anime-themed sample listings). The goal now is to broaden this into a general **image-generation prompt marketplace** — any visual style, any model (Midjourney, Stable Diffusion, DALL-E, Flux, etc.) — while keeping the distinctive pop-idol/holo visual identity and mascot system that make the site memorable.

**Decisions locked in for MVP1**:
- **Branding**: keep the PromptStar pop-idol aesthetic and mascots as-is — broaden the *content*, not the *visual identity*.
- **Monetization**: MVP1 is **free-only** — no real payments/Stripe/payouts. Pricing/checkout infrastructure is deferred to a later phase.
- **Scope**: strictly **still images** — no need to design ahead for video/audio prompt types.

This document analyzes the pivot across five lenses (edge cases, market gaps, differentiators, user workflow, tech stack), grounded in what's actually in the codebase, and ends with a concrete MVP1 roadmap.

---

## What's Already in Place (good news: the pivot is mostly content, not architecture)

The backend is **already generic** — the "anime" framing lives almost entirely in copy and sample data, not in the data model:

- **`db/migrations/003_prompt_listings.sql`** — `prompt_listings` table has `category TEXT`, `model TEXT`, `tags TEXT[]`, `price NUMERIC`. No anime enums or constraints.
- **`src/lib/api/listings.functions.ts`** — Zod validation: `category: z.string().min(1)` (any string), `model: z.enum([...])` already includes Midjourney/ChatGPT/DALL-E/Flux/Stable Diffusion.
- **`src/lib/mock-data.ts`** — `CATEGORIES` is already generic (`Image Generation`, `Content Writing`, `Coding`, `Marketing`, `Roleplay`); only the **sample prompt content and `TAGS`** (`#MECHA`, `#MAGICAL-GIRL`, `#IDOL`, `#HOLO`) are anime-flavored.
- **`src/routes/index.tsx`** filter UI is fully data-driven off `CATEGORIES`/`TAGS` — no hardcoded anime logic.
- Anime-specific *copy* lives in: `src/routes/__root.tsx` (meta tags: "Anime AI Prompt Marketplace"), `src/routes/index.tsx` (hero: "Hyperrealistic anime prompts"), `src/components/ContributeModal.tsx` (placeholder examples), `src/lib/mock-data.ts` (sample listings + "Senpai" mascot tips).
- **Pricing is currently 100% mocked** — `price NUMERIC(10,2)` exists in the schema and is displayed, but "Buy for $X" just opens `SaveToCollectionModal` (saves to binder). No checkout, ledger, or payout system exists — aligns with the "free-only MVP1" decision; nothing needs removing, just not building yet.
- **Images are stored inline as base64 data URIs** (`src/lib/api/listings.functions.ts`, ~6MB decoded cap) — the one piece of current architecture that becomes a real bottleneck as content volume grows beyond anime-niche scale.

---

## 1. Edge Cases

**Content quality & moderation**
- **NSFW/explicit imagery** — image-gen prompts are notoriously easy to push toward explicit content; broadening beyond a curated anime niche raises this risk. Needs an upload-time moderation gate, not just a ToS line.
- **Copyright/IP & likeness prompts** — prompts referencing copyrighted characters, named living artists' styles, trademarked franchises, or real people's likenesses (deepfake risk).
- **Bait-and-switch previews** — the cover image shown may not represent what the prompt actually produces (model drift, cherry-picked seed, undisclosed post-processing). The #1 trust problem in this market.
- **Spam/low-effort/duplicate listings** — copy-pasted or AI-generated prompt text flooding the catalog now that it's not a curated niche.

**Listing/data integrity**
- **Model-version drift** — a prompt tuned for Midjourney v5 may behave very differently on v6/v7, or not transfer to Stable Diffusion/Flux at all. Listings can silently go stale.
- **Cross-model compatibility claims** — sellers claiming "works on all models" when prompt syntax is model-specific (negative prompts, weights, `--ar`/`--style` flags are MJ-specific; SD uses different syntax entirely).
- **Missing generation parameters** — a prompt string alone is often not reproducible without seed, sampler, steps, CFG scale, aspect ratio, negative prompt — fields the current schema doesn't capture structurally (only free-text `body`/`tags`).

**Free-tier specific (since MVP1 has no paywall)**
- **Scraping/bulk harvesting** — bots vacuuming the entire catalog since there's no purchase gate; consider rate limits even without payments.
- **Low incentive for quality contributions** — without monetization, what motivates creators to publish *good* prompts rather than reposting others' work? (Reputation/discovery needs to fill this gap — see differentiators.)
- **Review/rating gaming** — current reviews are mocked; once real, sock-puppet accounts inflating ratings is a classic problem even on free platforms.

**Technical/scaling**
- **Inline base64 image storage** — will not scale past a small catalog (DB bloat, slow queries, no CDN caching). Becomes urgent the moment volume grows beyond the anime niche.
- **Search relevance at scale** — `index.tsx`'s in-memory `.filter()` over `allPrompts` works for mock-data scale; a general marketplace catalog will outgrow naive client-side filtering quickly.
- **Locale/currency display** — even with no real payments, showing "$X" to a global audience invites confusion; consider neutral "credits" or region-aware copy.

---

## 2. Market Gaps (PromptBase, Lexica, OpenArt, PromptHero, Civitai tend to miss these)

- **Trust gap**: most platforms show a prompt + a pretty preview image with no verification the prompt reliably reproduces it. Nobody has solved "does this actually work."
- **Parameter opacity**: prompts are sold as opaque text blobs; structured parameters (seed, sampler, negative prompt, aspect ratio) are rarely first-class.
- **No cross-model translation**: a buyer using Stable Diffusion can't easily find/adapt a Midjourney-authored prompt.
- **Style-first browsing only**: discovery is overwhelmingly "browse by aesthetic," with little support for *use-case*-driven discovery (e.g., "product photography," "book cover art," "game concept art," "social thumbnails").
- **Weak creator identity/reputation systems**: thin profiles, little portfolio-building, following, or social proof beyond a star rating.
- **No remix/community feedback loop**: buyers who get great results have nowhere to showcase that back to the community (which would also serve as social proof).

---

## 3. Selling Features / Differentiators to Build

With MVP1 free (no monetization pressure yet), the differentiators that matter most are **trust, discovery, and community**:

- **"Verified Output" badge** — periodically re-run listed prompts through model APIs and show *actual, current* sample outputs alongside the seller's preview, flagging drift. A standout trust signal nobody else has nailed.
- **Structured parameter cards** — promote seed/sampler/CFG/aspect-ratio/negative-prompt from buried free text into first-class, filterable, copyable fields (could add an optional `parameters JSONB` column without disruption).
- **Use-case-driven discovery** — categories/collections organized by *what you're making* rather than only by aesthetic.
- **Community remix gallery** — let users who generate from a prompt share their result back onto the listing page (visible social proof; also organically solves "does this even work").
- **Cross-model prompt variants** — let a single listing bundle Midjourney/SD/Flux versions of the "same idea."
- **Creator storefronts** — expand the existing profile/Studio system (`profile.tsx` already has bio, avatar, theme picker) into a public portfolio page per creator — cheap to build on what exists, and replaces monetization as a contribution incentive.
- **Mascot/companion system as gamification** (already built) — e.g., "earn badges/unlock companions for quality contributions" gives creators a non-monetary incentive, exactly what a free-tier marketplace needs.

---

## 4. User Workflow (MVP1 — free marketplace, no checkout)

**Buyer/browser flow**
1. **Discover** — browse Market by category/model/use-case/tag, or search by keyword (existing `index.tsx` filter UX, broadened).
2. **Evaluate** — view prompt detail: preview image(s), structured parameters, model compatibility, creator reputation, (eventually) verified-output badge and remix gallery.
3. **Acquire** — "Copy & Use" or "Save to Binder" (no purchase step in MVP1 — `prompt.$id.tsx` already branches free-vs-paid, so this simplifies the flow).
4. **Use** — paste the prompt + parameters into their generation tool of choice.
5. **Contribute back** (differentiator) — optionally post their generated result to the listing's remix gallery, rate/review.
6. **Organize** — save into Binder collections (already fully built in `dashboard.tsx`/`dashboard.collection.$id.tsx`).

**Creator flow**
1. **Publish** — use the existing `ContributeModal` (already generic: title, description, prompt body, model, category, tags, cover image) — needs broadened placeholder copy/examples and (recommended) optional structured-parameter fields.
2. **Build reputation** — accumulate views, saves, ratings, remix-gallery posts on their storefront/profile.
3. **Iterate** — update listings as models evolve (a "last verified" timestamp tied to the Verified Output badge would close the model-drift edge case).
4. **Get discovered** — via search, category browsing, "trending," and (later) featured/editorial picks.

---

## 5. Extra Tech Stack Needed for MVP1 (free-only, image-only)

Because payments are deferred, focus is on **storage, moderation, and search**:

| Need | Why | Suggested approach |
|---|---|---|
| **Object storage + CDN** | Inline base64 images won't scale past niche volume; the most urgent technical debt | S3-compatible storage (Cloudflare R2 / AWS S3) + CDN; replace the data-URI path in `listings.functions.ts` |
| **Image moderation (NSFW/IP)** | Broadening beyond curated anime content raises explicit-content and copyright risk | Upload-time SafeSearch-style scan (Google Vision SafeSearch / AWS Rekognition / open-source NSFW classifier) + manual review queue |
| **Search beyond client-side `.filter()`** | Naive in-memory filtering won't hold up once the catalog is general-purpose and large | Start with Postgres full-text search (`tsvector`/`pg_trgm`) — no new service required; graduate to Meilisearch/Typesense later if needed |
| **Rate limiting / abuse prevention** | No purchase gate means scraping and spam are the main abuse vectors | Lightweight middleware rate limiting (Upstash Redis, or simple IP/user-based limits in server functions) |
| **AI generation API access** (for "Verified Output" badge) | To periodically validate listings actually reproduce their preview | Replicate (hosts SD/Flux) + Midjourney/DALL-E API access — phase in after MVP1 ships |
| **Transactional email** | Needed for password reset, moderation notices, "your listing was flagged" — not currently present | Resend or Postmark (good DX with TanStack Start server functions) |

**Explicitly NOT needed for MVP1**: Stripe/Connect, payment ledger, payout/balance system, multi-currency/tax handling, video/audio taxonomy.

---

## 6. Other Edge Cases & Open Questions for Later Phases

- **Monetization transition**: when payments are introduced, today's free listings need a migration path (grandfather as free, or let creators re-price?).
- **International/legal**: once real money is involved, VAT/sales-tax handling (Stripe Tax) and creator KYC for payouts become unavoidable — plan *before* building checkout.
- **Commissioned/custom-prompt requests**: a "request a prompt" mode (buyer describes a need, creators bid) is a common evolution once a community forms.
- **API/power-user access**: bulk export, programmatic search, public discovery API — relevant once catalog and creator base grow.
- **Abuse appeals process**: once moderation exists, a documented appeal/dispute flow for flagged/removed listings is needed — policy as much as technical.

---

## 7. MVP1 Implementation Roadmap (sequenced — this is what we're executing now)

1. **Content/copy broadening** (low risk, highest immediate value — architecture already supports it):
   - Rewrite hero copy & meta tags (`__root.tsx`, `index.tsx`) from "Anime AI Prompt Marketplace" → general image-gen framing, keeping the pop-idol visual voice.
   - Replace anime-leaning sample listings and `TAGS` in `mock-data.ts` with a style-diverse set (photography, product, concept art, illustration, anime as one style among many, etc.).
   - Broaden `ContributeModal.tsx` placeholder examples beyond "Neo-Shinjuku Core."
2. **Storage migration**: move image storage from inline base64 to object storage + CDN before catalog growth.
3. **Trust/discovery differentiators**: structured parameter fields, creator storefronts, community remix gallery.
4. **Moderation & abuse baseline**: upload-time NSFW/IP scanning gate, rate limiting.
5. **Search upgrade**: client-side filtering → Postgres full-text search.

---

## Verification

- **Content audit**: grep for residual anime-specific strings (`anime`, `Senpai`, `Neo-Shinjuku`, `#MECHA`, etc.) across `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/lib/mock-data.ts`, `src/components/ContributeModal.tsx`.
- **Visual QA**: `npm run build` + 375/768/1280px viewport checks after copy/sample-data changes (hero and card layouts depend on string lengths).
- **Functional smoke test**: confirm category/tag filtering on the Market page works against the new style-diverse sample data (filter logic in `index.tsx` is data-driven and shouldn't need code changes).
- **Storage migration test** (when undertaken): verify upload → CDN URL → display round-trip, and that `image TEXT` can store URLs instead of data URIs without a breaking schema change.
