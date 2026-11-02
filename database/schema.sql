CREATE DATABASE IF NOT EXISTS orbit_db;
USE orbit_db;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('STUDENT','FACULTY','ADMIN') NOT NULL DEFAULT 'STUDENT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resources (
  resource_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  resource_type ENUM('LAB','LIBRARY','CANTEEN','PRINTING') NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  status ENUM('AVAILABLE','MAINTENANCE','INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
  CHECK (capacity >= 1)
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  resource_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  priority INT NOT NULL DEFAULT 3,
  service_time INT NOT NULL,
  status ENUM('PENDING','SCHEDULED','WAITING','COMPLETED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_bookings_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id),
  CHECK (end_time > start_time),
  CHECK (priority BETWEEN 1 AND 5),
  CHECK (service_time BETWEEN 1 AND 600)
);

CREATE TABLE IF NOT EXISTS processes (
  process_id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  arrival_time INT NOT NULL DEFAULT 0,
  burst_time INT NOT NULL,
  priority INT NOT NULL,
  state ENUM('NEW','READY','RUNNING','WAITING','SCHEDULED','COMPLETED','TERMINATED') NOT NULL DEFAULT 'NEW',
  completion_time INT NULL,
  waiting_time INT NULL,
  turnaround_time INT NULL,
  response_time INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_process_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  CHECK (arrival_time >= 0),
  CHECK (burst_time > 0),
  CHECK (priority BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS scheduling_history (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  algorithm VARCHAR(30) NOT NULL,
  waiting_time DECIMAL(10,2) NOT NULL,
  turnaround_time DECIMAL(10,2) NOT NULL,
  response_time DECIMAL(10,2) NOT NULL,
  scheduled_order LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resource_admins (
  resource_id INT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resource_admins_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id),
  CONSTRAINT fk_resource_admins_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_bookings_resource_window ON bookings(resource_id, start_time, end_time, status);
CREATE INDEX idx_bookings_user_created ON bookings(user_id, created_at);
CREATE INDEX idx_processes_state ON processes(state, created_at);

INSERT INTO resources (name,resource_type,capacity)
SELECT 'Computer Lab 1','LAB',60 WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='Computer Lab 1');
INSERT INTO resources (name,resource_type,capacity)
SELECT 'Library Table 1','LIBRARY',4 WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='Library Table 1');
INSERT INTO resources (name,resource_type,capacity)
SELECT 'Canteen Table 1','CANTEEN',6 WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='Canteen Table 1');
INSERT INTO resources (name,resource_type,capacity)
SELECT 'Printing Shop','PRINTING',1 WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='Printing Shop');
