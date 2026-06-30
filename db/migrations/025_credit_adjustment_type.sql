-- Distinct transaction type for admin credit adjustments.
--
-- Admin balance changes were being recorded as 'bonus', indistinguishable from
-- welcome/publish bonuses. Add an 'adjustment' type so they're identifiable in
-- the wallet history and admin transaction views. Follows the DROP + re-ADD
-- pattern from 006_fix_credit_types.sql.

ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('purchase', 'sale_earn', 'copy_earn', 'platform_fee', 'refund', 'bonus', 'withdrawal', 'adjustment'));
