-- Add profile image URL for admin users

ALTER TABLE pcmazing_admin_users
  ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500);
