-- Apply only to an existing ORBIT database whose processes table has the original schema.
ALTER TABLE processes
  MODIFY state ENUM('NEW','READY','RUNNING','WAITING','SCHEDULED','COMPLETED','TERMINATED') NOT NULL DEFAULT 'NEW',
  ADD COLUMN completion_time INT NULL,
  ADD COLUMN waiting_time INT NULL,
  ADD COLUMN turnaround_time INT NULL,
  ADD COLUMN response_time INT NULL,
  ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE scheduling_history MODIFY scheduled_order LONGTEXT NOT NULL;
