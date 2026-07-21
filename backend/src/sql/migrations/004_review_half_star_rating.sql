-- Allow half-star ratings (0.5 to 5.0)

ALTER TABLE customer_reviews
  ALTER COLUMN rating TYPE NUMERIC(2, 1)
  USING rating::numeric(2, 1);

ALTER TABLE customer_reviews
  DROP CONSTRAINT IF EXISTS customer_reviews_rating_check;

ALTER TABLE customer_reviews
  ADD CONSTRAINT customer_reviews_rating_check
  CHECK (
    rating >= 0.5
    AND rating <= 5
    AND (rating * 2) = floor(rating * 2)
  );
