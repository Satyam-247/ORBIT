USE orbit_db;

-- Safe to run on an existing ORBIT database. resource_id as the primary key
-- guarantees that only one admin can be assigned to each resource.
CREATE TABLE IF NOT EXISTS resource_admins (
  resource_id INT PRIMARY KEY,
  user_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resource_admins_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id),
  CONSTRAINT fk_resource_admins_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE KEY uq_resource_admins_user_resource (user_id, resource_id)
);
