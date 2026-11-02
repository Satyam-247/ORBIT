-- Apply to the original resource_admins table if user_id is not already unique.
-- Resolve duplicate user_id assignments before applying this migration.
ALTER TABLE resource_admins ADD UNIQUE KEY uq_resource_admins_user (user_id);
