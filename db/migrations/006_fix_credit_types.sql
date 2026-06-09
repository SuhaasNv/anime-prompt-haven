-- Fix credit_transactions type constraint to include copy_earn and platform_fee
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('purchase', 'sale_earn', 'copy_earn', 'platform_fee', 'refund', 'bonus', 'withdrawal'));
