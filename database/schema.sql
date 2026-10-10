CREATE DATABASE IF NOT EXISTS orbit_db;
USE orbit_db;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('STUDENT','FACULTY','ADMIN') NOT NULL DEFAULT 'STUDENT'
);

CREATE TABLE resources (
  resource_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  resource_type ENUM('LAB','LIBRARY','CANTEEN','PRINTING') NOT NULL,
  capacity INT DEFAULT 1,
  status ENUM('AVAILABLE','MAINTENANCE','INACTIVE') DEFAULT 'AVAILABLE'
);

CREATE TABLE bookings (
  booking_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  resource_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  priority INT DEFAULT 3,
  service_time INT NOT NULL,
  status ENUM('PENDING','SCHEDULED','WAITING','COMPLETED','REJECTED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (resource_id) REFERENCES resources(resource_id)
);

CREATE TABLE processes (
  process_id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNIQUE NOT NULL,
  arrival_time INT NOT NULL,
  burst_time INT NOT NULL,
  priority INT NOT NULL,
  state ENUM('NEW','READY','RUNNING','WAITING','COMPLETED') DEFAULT 'NEW',
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

CREATE TABLE scheduling_history (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  algorithm VARCHAR(30) NOT NULL,
  waiting_time DECIMAL(10,2) NOT NULL,
  turnaround_time DECIMAL(10,2) NOT NULL,
  response_time DECIMAL(10,2) NOT NULL,
  scheduled_order VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

INSERT INTO resources (name,resource_type,capacity) VALUES
('Computer Lab 1','LAB',60),
('Library Table 1','LIBRARY',4),
('Canteen Table 1','CANTEEN',6),
('Printing Shop','PRINTING',1);

CREATE INDEX idx_bookings_resource_window ON bookings(resource_id, start_time, end_time, status);
CREATE INDEX idx_bookings_user_created ON bookings(user_id, created_at);
