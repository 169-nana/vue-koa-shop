-- 第 5 个数据库变更：商家入驻、商品审核、后台角色与站内消息
-- 请在 001 至 004 执行完成后运行本文件

ALTER TABLE vueshop_admin
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin' AFTER avatar,
  ADD COLUMN status TINYINT NOT NULL DEFAULT 1 AFTER role;

CREATE TABLE IF NOT EXISTS vueshop_merchant (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  shop_name VARCHAR(100) NOT NULL,
  contact_name VARCHAR(50) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  qualification_picture VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(1000) NOT NULL DEFAULT '',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_merchant_user (user_id),
  UNIQUE KEY uk_merchant_shop_name (shop_name),
  KEY idx_merchant_status_submitted (status, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE vueshop_goods
  ADD COLUMN merchant_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN sale_status VARCHAR(20) NOT NULL DEFAULT 'on_sale' AFTER stock,
  ADD KEY idx_goods_merchant (merchant_id),
  ADD KEY idx_goods_public (sale_status, id);

CREATE TABLE IF NOT EXISTS vueshop_goods_submission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  goods_id INT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(20) NOT NULL DEFAULT 'create',
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  picture VARCHAR(255) NOT NULL,
  spec VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  rejection_reason VARCHAR(1000) NOT NULL DEFAULT '',
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,
  reviewed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_submission_merchant (merchant_id, updated_at),
  KEY idx_submission_status (status, submitted_at),
  CONSTRAINT fk_submission_merchant FOREIGN KEY (merchant_id) REFERENCES vueshop_merchant(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_goods_submission_album (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id BIGINT UNSIGNED NOT NULL,
  picture VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_submission_album (submission_id),
  CONSTRAINT fk_submission_album FOREIGN KEY (submission_id)
    REFERENCES vueshop_goods_submission(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_rejection_reason (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scene VARCHAR(30) NOT NULL,
  label VARCHAR(200) NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reason_scene_label (scene, label),
  KEY idx_reason_scene_enabled (scene, enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_review_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_type VARCHAR(30) NOT NULL,
  business_id BIGINT UNSIGNED NOT NULL,
  decision VARCHAR(20) NOT NULL,
  reason_ids JSON NOT NULL,
  reason_snapshot JSON NOT NULL,
  additional_note VARCHAR(500) NOT NULL DEFAULT '',
  reviewer_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_review_business (business_type, business_id),
  KEY idx_review_reviewer (reviewer_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_notification (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content VARCHAR(1500) NOT NULL,
  business_type VARCHAR(30) NOT NULL,
  business_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notification_user_read (user_id, read_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO vueshop_rejection_reason (scene, label, sort_order) VALUES
('merchant_application', '申请资料不完整', 10),
('merchant_application', '资质图片不清晰', 20),
('merchant_application', '资质信息与申请人不一致', 30),
('merchant_application', '店铺名称不符合规范', 40),
('merchant_application', '联系方式无效', 50),
('merchant_application', '经营范围不符合平台要求', 60),
('merchant_application', '存在重复申请', 70),
('merchant_application', '其他原因', 100),
('goods_submission', '商品名称不符合规范', 10),
('goods_submission', '商品分类选择错误', 20),
('goods_submission', '主图或相册图片不符合要求', 30),
('goods_submission', '商品描述不完整或与实物不符', 40),
('goods_submission', '价格异常', 50),
('goods_submission', '规格信息不完整', 60),
('goods_submission', '缺少必要资质', 70),
('goods_submission', '涉及禁售或限制销售内容', 80),
('goods_submission', '与已有商品重复', 90),
('goods_submission', '其他原因', 100);
