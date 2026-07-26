-- Product image for inventory materials
ALTER TABLE tblmaterials
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

COMMENT ON COLUMN tblmaterials.image_url IS
  'Public URL path to the product image file.';
