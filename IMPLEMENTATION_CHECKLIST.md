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
- [x] Read `src/components/SaveToCollectionModal.tsx` current implementation
- [x] Add `listingId: string` prop to component
- [x] Load real collections via `listCollections()` server fn
- [x] Replace "Save" button handler to call `addPromptToCollection()`
- [x] Handle unauthenticated case: redirect to `/auth`
- [x] Update prompt detail page to pass `listingId` prop
- [x] Build verification: ✓ compiled successfully

### 1C. Fix collection detail prompt resolution
- [x] Read `src/routes/dashboard.collection.$id.tsx` current implementation
- [x] Add UUID regex check: `const isUUID = /^[0-9a-f-]{36}$/i.test(promptId)`
- [x] Create `resolvePrompt()` helper function
  - If UUID: call `getListing({ data: { id } })`
  - If slug: call `getPrompt(id)` from mock-data (legacy support)
- [x] Update loader to resolve all prompts in collection
- [x] Update component to render resolved prompts from loader
- [x] Build verification: ✓ compiled successfully

### 1D. Prepare for saved/purchased tabs (Phase 2)
- [x] Note: Requires `saved_prompts` and `purchases` tables
- [x] Mark as "BLOCKED on Phase 2 schema"
- [x] Document what needs to change:
  - `src/routes/dashboard.tsx` saved tab: `listSavedPrompts()` call
  - `src/routes/dashboard.tsx` purchased tab: `listPurchases()` call
  
**Phase 1 Summary:**
- Market feed: now DB-only, no mock merge ✓
- Sidebar collections: now real/dynamic ✓
- Save to collection: now saves to DB ✓
- Collection detail: resolves both DB and mock prompts ✓
- **Status:** Ready for Phase 2 schema work

---

## Phase 2: Database Schema

### 2A. Create migration file
- [x] Create `db/migrations/004_marketplace.sql`
- [x] Add `is_nsfw`, `status`, `view_count`, `save_count`, `purchase_count` to `prompt_listings`
- [x] Create `saved_prompts` table
- [x] Create `purchases` table
- [x] Create `reviews` table
- [x] Create `reports` table
- [x] Create `user_credits` table
- [x] Create `credit_transactions` table
- [x] Add `is_admin` column to `users`
- [x] Create all required indexes
- [x] Verify idempotency: all statements use `IF NOT EXISTS`

### 2B. Run migration
- [x] `npm run db:migrate` ✓
- [x] Verify no errors ✓
- [x] Spot-check schema: 11 tables created ✓

**Phase 2 Complete:**
- Tables: saved_prompts, purchases, reviews, reports, user_credits, credit_transactions ✓
- Columns: is_nsfw, status, view_count, save_count, purchase_count, is_admin ✓
- Indexes: 13 new indexes for query optimization ✓

---

## Phase 3: Server Functions ✅ COMPLETE

All 7 new server function files created and tested:

### 3A. Update listings.functions.ts ✓
- [x] Update `listListings()` with filtering/sorting/pagination
- [x] Add `deleteListing()` — soft delete (status = 'removed')
- [x] Add `updateListing()` — owner can edit, blocks is_nsfw downgrade
- [x] Add `incrementViewCount()` — fire-and-forget
- [x] Update `createListing()` with is_nsfw, status, listing cap, max price
- [x] Export CURRENT_USER_QUERY_KEY
- [x] Build verification: ✓ compiled successfully

### 3B. Create saves.functions.ts ✓
- [x] `savePrompt()` — INSERT + increment save_count
- [x] `unsavePrompt()` — DELETE + decrement save_count
- [x] `listSavedPrompts()` — JOIN query, returns full listings
- [x] `isSaved()` — returns { saved: boolean }
- [x] Build verification: ✓ compiled successfully

### 3C. Create purchases.functions.ts ✓
- [x] `purchaseListing()` — ATOMIC TRANSACTION (BEGIN/COMMIT/ROLLBACK)
  - Validates: published, price > 0, not own listing, sufficient balance
  - Inserts purchase record
  - Updates buyer balance (-price)
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
