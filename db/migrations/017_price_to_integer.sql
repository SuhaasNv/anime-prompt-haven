-- Migrate price column from NUMERIC(10, 2) USD to INTEGER credits (1-5 scale)
-- Keep balance/transaction amounts as NUMERIC for fractional commission splits

-- Ensure any existing prices are converted to integers (round down)
UPDATE prompt_listings SET price = FLOOR(price)::INT WHERE price IS NOT NULL;

-- Alter column type to INTEGER using FLOOR conversion
ALTER TABLE prompt_listings
  ALTER COLUMN price TYPE INTEGER USING FLOOR(price)::INTEGER;

-- Set default
ALTER TABLE prompt_listings
  ALTER COLUMN price SET DEFAULT 0;

-- Add CHECK constraint for 0-5 range
ALTER TABLE prompt_listings
  ADD CONSTRAINT price_valid_range CHECK (price >= 0 AND price <= 5);

-- Add comment for clarity
COMMENT ON COLUMN prompt_listings.price IS 'Price in credits: 0 = free, 1-5 = paid listings';
