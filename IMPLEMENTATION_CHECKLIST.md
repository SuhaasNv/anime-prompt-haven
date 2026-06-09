# PromptStar Marketplace Implementation Checklist

**Status:** In Progress  
**Plan Reference:** `/Users/suhaasnv/.claude/plans/compressed-soaring-adleman.md`

---

## Phase 1: Core Centralization (Break Mock Dependencies)

### 1A. Remove mock-data merge from market feed
- [x] Read `src/routes/index.tsx` current implementation
- [x] Remove `allPrompts = useMemo(() => [...listings, ...PROMPTS], ...)`
- [x] Update to use only DB listings
- [x] Add empty state UI ("Be the first to contribute!")
- [x] Remove mock `COLLECTIONS` from sidebar
- [x] Replace with real `listCollections()` for logged-in users
- [x] Show "Sign in to see your binder" for anonymous users
- [x] Test: market shows only DB listings, sidebar shows real collections
- [x] Build verification: ✓ compiled successfully

### 1B. Fix SaveToCollectionModal
- [ ] Read `src/components/SaveToCollectionModal.tsx` current implementation
- [ ] Add `listingId: string` prop to component
- [ ] Load real collections via `listCollections()` server fn
- [ ] Replace "Save" button handler to call `addPromptToCollection()`
- [ ] Handle unauthenticated case: redirect to `/auth`
- [ ] Test: saving a prompt to a collection works, appears in collection detail

### 1C. Fix collection detail prompt resolution
- [ ] Read `src/routes/dashboard.collection.$id.tsx` current implementation
- [ ] Add UUID regex check: `const isUUID = /^[0-9a-f-]{36}$/i.test(promptId)`
- [ ] For each `promptId` in collection:
  - If UUID: call `getListing({ data: { id } })`
  - If slug: call `getPrompt(id)` from mock-data (legacy support)
- [ ] Update component to render resolved prompts
- [ ] Test: DB prompts in collections render correctly

### 1D. Prepare for saved/purchased tabs (Phase 2)
- [ ] Note: Requires `saved_prompts` and `purchases` tables
- [ ] Mark as "BLOCKED on Phase 2 schema"
- [ ] Document what needs to change:
  - `src/routes/dashboard.tsx` saved tab: `listSavedPrompts()` call
  - `src/routes/dashboard.tsx` purchased tab: `listPurchases()` call

---

## Phase 2: Database Schema

### 2A. Create migration file
- [ ] Create `db/migrations/004_marketplace.sql`
- [ ] Add `is_nsfw`, `status`, `view_count`, `save_count`, `purchase_count` to `prompt_listings`
- [ ] Create `saved_prompts` table
- [ ] Create `purchases` table
- [ ] Create `reviews` table
- [ ] Create `reports` table
- [ ] Create `user_credits` table
- [ ] Create `credit_transactions` table
- [ ] Add `is_admin` column to `users`
- [ ] Create all required indexes
- [ ] Verify idempotency: all statements use `IF NOT EXISTS`

### 2B. Run migration
- [ ] `npm run db:migrate`
- [ ] Verify no errors
- [ ] Spot-check schema: `psql promptstar -c "\dt"` to list tables

---

## Phase 3: Server Functions

### 3A. Update listings.functions.ts
- [ ] Update `listListings()` signature:
  - Add `showNsfw?: boolean` (default false)
  - Add `sort?: 'newest' | 'trending' | 'price_asc' | 'price_desc' | 'rating'`
  - Add `category?, model?, tags?, search?, maxPrice?, minPrice?, limit?, offset?`
- [ ] Add WHERE clause: `status = 'published'`
- [ ] Add NSFW filter: `AND (is_nsfw = false OR is_nsfw = true)` based on `showNsfw`
- [ ] Add pagination: `LIMIT 24 OFFSET $n`
- [ ] Add trending sort: `ORDER BY (view_count * 0.2 + purchase_count * 2.0 + save_count * 0.8) DESC`
- [ ] Add `deleteListing()` fn: sets `status = 'removed'`, owner/admin only
- [ ] Add `updateListing()` fn: edits title/desc/body/price/category/model/tags/is_nsfw/status, owner only, blocks `is_nsfw: true → false`
- [ ] Add `incrementViewCount()` fn: fire-and-forget POST
- [ ] Update `createListing()` signature:
  - Add `is_nsfw: boolean` param
  - Add `status: z.enum(['draft', 'published'])` param
  - Add listing cap check: throw if user has ≥10 active listings
  - Add max price cap: $49.99
- [ ] Test: `npm run build` passes

### 3B. Create saves.functions.ts
- [ ] New file: `src/lib/api/saves.functions.ts`
- [ ] `savePrompt()` — POST, auth required
  - `INSERT INTO saved_prompts ... ON CONFLICT DO NOTHING`
  - `UPDATE prompt_listings SET save_count = save_count + 1`
  - Return `{ ok: true }`
- [ ] `unsavePrompt()` — POST, auth required
  - `DELETE FROM saved_prompts WHERE user_id=$1 AND listing_id=$2`
  - `UPDATE prompt_listings SET save_count = save_count - 1`
  - Return `{ ok: true }`
- [ ] `listSavedPrompts()` — GET, auth required
  - JOIN `saved_prompts` with `prompt_listings`
  - Return array of full listings
- [ ] `isSaved()` — GET, auth required
  - Return `{ saved: boolean }`
- [ ] Test: `npm run build` passes

### 3C. Create purchases.functions.ts
- [ ] New file: `src/lib/api/purchases.functions.ts`
- [ ] `purchaseListing()` — POST, auth required, **ATOMIC TRANSACTION**
  - Validate listing exists, published, price > 0, not owned by buyer
  - Check buyer balance >= price
  - Wrap in transaction:
    - `INSERT INTO purchases`
    - `UPDATE user_credits SET balance -= price` (buyer)
    - `UPDATE user_credits SET balance += (price * 0.8)` (seller)
    - `INSERT INTO credit_transactions` × 2
    - `UPDATE prompt_listings SET purchase_count += 1`
  - Return `{ ok: true, newBalance: number }`
- [ ] `listPurchases()` — GET, auth required
  - Return purchases with full listing details
- [ ] `hasPurchased()` — GET, auth required
  - Return `{ purchased: boolean }`
- [ ] `topUpCredits()` — POST, auth required, DEMO ONLY
  - Add +50.00 credits (fixed amount for MVP)
  - Insert transaction record
  - Return `{ ok: true, newBalance: number }`
- [ ] Test: `npm run build` passes

### 3D. Create reviews.functions.ts
- [ ] New file: `src/lib/api/reviews.functions.ts`
- [ ] `createReview()` — POST, auth required
  - Validate: user has purchased listing (check `purchases` table)
  - Validate: rating 1–5, body ≤500 chars
  - `INSERT INTO reviews ... ON CONFLICT (listing_id, user_id) DO NOTHING`
  - Return `{ ok: true }`
- [ ] `listReviews()` — GET, no auth
  - Return reviews with username, rating, body, created_at
  - Order by `created_at DESC`
- [ ] `getAverageRating()` — GET, no auth
  - Return `{ average: number | null, count: number }`
- [ ] Test: `npm run build` passes

### 3E. Create reports.functions.ts
- [ ] New file: `src/lib/api/reports.functions.ts`
- [ ] `reportListing()` — POST, auth required
  - Validate: user ≠ listing owner
  - `INSERT INTO reports ... ON CONFLICT DO NOTHING`
  - Check report count: `SELECT COUNT(*) FROM reports WHERE listing_id=$1`
  - If count >= 5:
    - `UPDATE prompt_listings SET status = 'flagged'`
  - If reason = 'nsfw_undisclosed':
    - `UPDATE prompt_listings SET is_nsfw = true`
  - Return `{ ok: true, flagged: boolean }`
- [ ] `listReports()` — GET, admin only
  - Return flagged listings with report counts by reason
- [ ] `moderateListing()` — POST, admin only
  - Validate: `action` is 'restore' | 'remove'
  - Update listing `status` accordingly
  - Return `{ ok: true }`
- [ ] Test: `npm run build` passes

### 3F. Create credits.functions.ts
- [ ] New file: `src/lib/api/credits.functions.ts`
- [ ] `getMyCredits()` — GET, auth required
  - Return `{ balance: number }`
- [ ] `listTransactions()` — GET, auth required
  - Return transaction history ordered by `created_at DESC`
- [ ] Test: `npm run build` passes

### 3G. Auth signup bonus
- [ ] Update `signUp()` in `src/lib/api/auth.functions.ts`
- [ ] After user creation, insert `user_credits` row with `balance = 5.00`
- [ ] Insert transaction record: `type = 'bonus'`, `amount = 5.00`

---

## Phase 4: UI Changes

### 4A. Update market index (src/routes/index.tsx)
- [ ] Remove mock data merge
- [ ] Add NSFW toggle (persisted to localStorage)
- [ ] Add sort dropdown UI
- [ ] Add filter UI (category, price range)
- [ ] Update `listListings()` call with dynamic params
- [ ] Replace sidebar with real collections or "Sign in" prompt
- [ ] Add empty state when no listings
- [ ] Test: market shows only DB listings, filters work

### 4B. Update prompt detail page (src/routes/prompt.$id.tsx)
- [ ] Call `incrementViewCount()` on mount
- [ ] Load real reviews via `listReviews()`
- [ ] Replace hardcoded reviews with `ReviewList` component
- [ ] Replace favorite button with `isSaved()` + mutations
- [ ] Add purchase flow: "Buy" button → `purchaseListing()`
- [ ] Show credit balance in sidebar
- [ ] Add "Report" button → opens `ReportModal`
- [ ] Add owner controls (Edit/Delete) if `user.id === listing.userId`
- [ ] Test: all interactions work

### 4C. Update dashboard (src/routes/dashboard.tsx)
- [ ] Saved tab: replace mock with `listSavedPrompts()` result
- [ ] Purchased tab: replace mock with `listPurchases()` result
- [ ] Add "My Listings" tab:
  - Show user's own listings (filter by `user_id`)
  - Display status badge, purchase count, earnings
  - Add Edit/Delete controls
- [ ] Add credits display in header
- [ ] Add "Top Up Credits" button
- [ ] Update stats bar with real DB counts
- [ ] Test: all tabs show real data

### 4D. Update SaveToCollectionModal (src/components/SaveToCollectionModal.tsx)
- [ ] Already done in Phase 1B

### 4E. Update ContributeModal (src/components/ContributeModal.tsx)
- [ ] Add `is_nsfw` checkbox
- [ ] Add `status` toggle (draft/publish)
- [ ] Add listing cap warning
- [ ] Pass new fields to `createListing()`
- [ ] Test: can create NSFW draft/published prompts

### 4F. Update Navbar (src/components/Navbar.tsx)
- [ ] Add `CreditBalanceWidget` if logged in
- [ ] Show ✦ {balance} with top-up button
- [ ] Test: balance updates after purchase

---

## Phase 5: New Components

### 5A. ReportModal
- [ ] `src/components/ReportModal.tsx`
- [ ] Reason selector (dropdown)
- [ ] Optional note textarea (max 300 chars)
- [ ] Submit button calls `reportListing()`
- [ ] Success state feedback

### 5B. CreditBalanceWidget
- [ ] `src/components/CreditBalanceWidget.tsx`
- [ ] Display: ✦ {balance}
- [ ] Button: "Top Up"
- [ ] Click handler: opens credit top-up modal or integrates payment

### 5C. NsfwBlurCard
- [ ] `src/components/NsfwBlurCard.tsx`
- [ ] Wraps `PromptCard`
- [ ] If NSFW: render blur overlay + "Reveal" button
- [ ] Click to toggle reveal state

### 5D. ReviewForm
- [ ] `src/components/ReviewForm.tsx`
- [ ] Star rating (1–5)
- [ ] Optional text (max 500 chars)
- [ ] Submit button calls `createReview()`
- [ ] Show only if user has purchased listing

### 5E. ReviewList
- [ ] `src/components/ReviewList.tsx`
- [ ] Render array of reviews
- [ ] Show: username, rating, body, created_at
- [ ] Load via `listReviews()`

### 5F. MyListingsTab
- [ ] `src/components/MyListingsTab.tsx`
- [ ] Query user's listings via `listListings({ userId })`
- [ ] Show status badge (Published/Draft/Flagged)
- [ ] Show purchase count, earnings
- [ ] Edit/Delete buttons

---

## Phase 6: Admin Route

### 6A. Create admin page (src/routes/admin.tsx)
- [ ] New file: `src/routes/admin.tsx`
- [ ] `beforeLoad`: Check `user.is_admin`, redirect to `/` if not
- [ ] Load flagged listings via `listReports()`
- [ ] Display with report counts and reasons
- [ ] "Restore" and "Remove" buttons
- [ ] Call `moderateListing()` on action
- [ ] Test: admin can moderate, non-admins are redirected

---

## Testing & Verification

### Integration Tests
- [ ] **Test 1:** User A creates 2 prompts (1 SFW, 1 NSFW)
  - [ ] Both visible in market only when NSFW toggle is correct
  - [ ] A can see both in "My Listings" tab
- [ ] **Test 2:** User B buys A's paid prompt
  - [ ] B's balance decreases by price
  - [ ] A's balance increases by 80% of price
  - [ ] Transaction records created
  - [ ] Purchase appears in B's "Purchased" tab
- [ ] **Test 3:** User B saves A's free prompt
  - [ ] Appears in B's "Saved" tab
  - [ ] Save count increments on listing
- [ ] **Test 4:** User B adds A's prompt to collection
  - [ ] Collection detail shows the prompt
  - [ ] UUID resolution works
- [ ] **Test 5:** 5 users report A's prompt as spam
  - [ ] After 5th report, listing auto-flags
  - [ ] Disappears from market
  - [ ] Appears in admin queue
- [ ] **Test 6:** Admin restores flagged listing
  - [ ] Status back to 'published'
  - [ ] Re-appears in market
- [ ] **Test 7:** User B tries to buy same prompt twice
  - [ ] Second purchase fails with "Already owned"
- [ ] **Test 8:** Build verification
  - [ ] `npm run build` outputs "✓ built in XXXms"
  - [ ] No TypeScript errors

---

## Blockers / Dependencies

- [ ] Phase 2 (schema) must complete before Phase 3 (server functions)
- [ ] Phase 3 (functions) must complete before Phase 4 (UI)
- [ ] Phase 1A (remove mock) should happen early to unblock Phase 4

---

## Timeline Estimate

- Phase 1: 1–2 hours (breaking mocks)
- Phase 2: 30 min (migration)
- Phase 3: 3–4 hours (7 function files)
- Phase 4: 2–3 hours (route/component updates)
- Phase 5: 1–2 hours (new components)
- Phase 6: 1 hour (admin page)
- Testing: 1–2 hours

**Total: ~10–15 hours of focused work**

---

## Quick Navigation

- **Plan**: `/Users/suhaasnv/.claude/plans/compressed-soaring-adleman.md`
- **Project**: `/Users/suhaasnv/Documents/Desktop ALT/portfolioprojects/anime-prompt-haven`
- **Dev Server**: `http://localhost:3000`
- **Database**: `promptstar` on `localhost:5432`

---

**Last Updated:** 2026-06-09  
**Status:** Ready to start Phase 1
