-- ============================================================================
-- Financial Controls: Payouts, Disputes, and Compliance
-- ============================================================================

-- ============================================================================
-- 1. Creator Payouts (Pending approval/rejection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  bank_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  UNIQUE(creator_id, status, created_at)
);

CREATE INDEX IF NOT EXISTS creator_payouts_creator_id_idx ON creator_payouts(creator_id);
CREATE INDEX IF NOT EXISTS creator_payouts_status_idx ON creator_payouts(status);
CREATE INDEX IF NOT EXISTS creator_payouts_created_at_idx ON creator_payouts(created_at DESC);

-- ============================================================================
-- 2. Disputes (Buyer vs Seller)
-- ============================================================================

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) <= 500),
  evidence TEXT CHECK (char_length(evidence) <= 2000),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'appealed')),
  resolution TEXT CHECK (char_length(resolution) <= 500),
  resolved_by UUID REFERENCES users(id),
  winner TEXT CHECK (winner IN ('buyer', 'seller', 'settlement')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(purchase_id)
);

CREATE INDEX IF NOT EXISTS disputes_buyer_id_idx ON disputes(buyer_id);
CREATE INDEX IF NOT EXISTS disputes_seller_id_idx ON disputes(seller_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes(status);
CREATE INDEX IF NOT EXISTS disputes_created_at_idx ON disputes(created_at DESC);

-- ============================================================================
-- 3. Deleted User Data Archive (for compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deleted_users_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_hash TEXT NOT NULL,
  data_json JSONB NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retention_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 years'),
  purged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS deleted_users_archive_retention_idx ON deleted_users_archive(retention_until);
CREATE INDEX IF NOT EXISTS deleted_users_archive_purged_idx ON deleted_users_archive(purged_at);

-- ============================================================================
-- Migration complete
-- ============================================================================
