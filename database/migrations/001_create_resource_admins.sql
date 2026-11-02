CREATE TABLE IF NOT EXISTS resource_admins (
  resource_id INT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resource_admins_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id),
  CONSTRAINT fk_resource_admins_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);
