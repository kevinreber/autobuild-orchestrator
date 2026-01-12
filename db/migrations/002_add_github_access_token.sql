-- Add github_access_token column to users table
-- Token is stored encrypted using AES-256-GCM
ALTER TABLE users ADD COLUMN github_access_token TEXT;
