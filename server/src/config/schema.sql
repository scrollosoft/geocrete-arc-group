-- GeoCrete ARC Group – MySQL schema
-- Run this once against the geocrete_arc database in XAMPP phpMyAdmin or MySQL CLI.
-- All existing tables are created only if they do not already exist.

CREATE DATABASE IF NOT EXISTS geocrete_arc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE geocrete_arc;

-- ----------------------------------------------------------------
-- bank_accounts
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_number     VARCHAR(100)  NOT NULL DEFAULT '',
  account_number_tag VARCHAR(100)  NOT NULL DEFAULT 'ACCOUNT #01',
  bank_name          VARCHAR(255)  NOT NULL,
  account_code       VARCHAR(50)   NOT NULL,
  balance            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  credit             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  accent_color       VARCHAR(20)   NOT NULL DEFAULT '#3980FF',
  is_active          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- sites
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sites (
  id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name                     VARCHAR(255)  NOT NULL,
  location                 VARCHAR(255)  NOT NULL,
  site_owner               VARCHAR(255)  NOT NULL,
  total_budget             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_spent              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status                   ENUM('Active','Completed','On Hold','Inactive') NOT NULL DEFAULT 'Active',
  start_date               DATE          NOT NULL DEFAULT (CURDATE()),
  expected_completion_date DATE          NULL,
  description              TEXT          NOT NULL DEFAULT '',
  budget_alert_count       INT           NOT NULL DEFAULT 1,
  created_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_name (name),
  INDEX idx_total_budget (total_budget)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- suppliers
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  company_name   VARCHAR(255) NOT NULL DEFAULT '',
  contact_person VARCHAR(255) NOT NULL DEFAULT '',
  phone          VARCHAR(50)  NOT NULL DEFAULT '',
  email          VARCHAR(255) NOT NULL DEFAULT '',
  address        TEXT         NOT NULL DEFAULT '',
  categories     VARCHAR(500) NOT NULL DEFAULT '',
  payment_terms  VARCHAR(100) NOT NULL DEFAULT 'Immediate',
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- expenses
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date           DATE          NOT NULL,
  site_id        INT UNSIGNED  NOT NULL,
  supplier_id    INT UNSIGNED  NULL DEFAULT NULL,
  category       VARCHAR(100)  NOT NULL DEFAULT 'Material',
  quantity       DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  unit           VARCHAR(50)   NOT NULL DEFAULT 'Units',
  rate_per_unit  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  amount         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  paid_amount    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  pending_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(100)  NOT NULL DEFAULT 'Bank Transfer',
  remark         TEXT          NOT NULL DEFAULT '',
  status         ENUM('Pending','Partial','Paid','Completed') NOT NULL DEFAULT 'Completed',
  applied_to_material TINYINT(1) NOT NULL DEFAULT 0,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_site     FOREIGN KEY (site_id)     REFERENCES sites(id)     ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_expense_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_site_id (site_id),
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_date (date),
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- labours
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS labours (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  phone         VARCHAR(50)   NOT NULL DEFAULT '+91234567892',
  trade         VARCHAR(100)  NOT NULL DEFAULT 'Mason',
  site_id       INT UNSIGNED  NULL DEFAULT NULL,
  daily_rate    DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
  wages_earned  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_paid    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  joining_date  DATE          NOT NULL DEFAULT (CURDATE()),
  payment_type  ENUM('Daily','Weekly','Monthly') NOT NULL DEFAULT 'Daily',
  address       TEXT          NOT NULL DEFAULT '',
  remarks       TEXT          NOT NULL DEFAULT '',
  status        ENUM('Active','Inactive','On Leave') NOT NULL DEFAULT 'Active',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_labour_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_site_id (site_id),
  INDEX idx_trade (trade),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- materials
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ref_number    VARCHAR(50)   NOT NULL UNIQUE,
  purchase_date DATE          NOT NULL,
  site_id       INT UNSIGNED  NOT NULL,
  supplier_id   INT UNSIGNED  NULL DEFAULT NULL,
  category      VARCHAR(100)  NOT NULL DEFAULT 'Other',
  quantity      DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  unit          VARCHAR(50)   NOT NULL DEFAULT 'Units',
  unit_price    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_cost    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  paid_amount   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  quantity_used DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  payment_status ENUM('Pending','Partial','Paid') NOT NULL DEFAULT 'Pending',
  notes         TEXT          NOT NULL DEFAULT '',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_material_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_material_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_site_id (site_id),
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_purchase_date (purchase_date),
  INDEX idx_category (category),
  INDEX idx_payment_status (payment_status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
