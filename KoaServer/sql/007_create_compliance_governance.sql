-- 第 7 个数据库变更：审核留痕与违规处置
-- 请在 006_allow_multiple_merchant_shops.sql 执行完成后运行本文件

ALTER TABLE vueshop_goods
  ADD COLUMN compliance_status VARCHAR(30) NOT NULL DEFAULT 'normal' AFTER sale_status,
  ADD COLUMN compliance_reason VARCHAR(1000) NOT NULL DEFAULT '' AFTER compliance_status,
  ADD COLUMN enforced_at DATETIME NULL AFTER compliance_reason,
  ADD COLUMN enforced_by INT NULL AFTER enforced_at,
  ADD KEY idx_goods_compliance (compliance_status, enforced_at);

ALTER TABLE vueshop_merchant
  ADD COLUMN enforcement_reason VARCHAR(1000) NOT NULL DEFAULT '' AFTER rejection_reason,
  ADD COLUMN enforced_at DATETIME NULL AFTER enforcement_reason,
  ADD COLUMN enforced_by INT NULL AFTER enforced_at;

ALTER TABLE vueshop_review_record
  ADD COLUMN business_snapshot JSON NULL AFTER business_id,
  ADD COLUMN related_goods_id INT NULL AFTER business_snapshot,
  ADD COLUMN merchant_id BIGINT UNSIGNED NULL AFTER related_goods_id,
  ADD COLUMN reviewer_name_snapshot VARCHAR(100) NOT NULL DEFAULT '' AFTER reviewer_id,
  ADD COLUMN reviewer_role_snapshot VARCHAR(20) NOT NULL DEFAULT '' AFTER reviewer_name_snapshot;

CREATE TABLE IF NOT EXISTS vueshop_enforcement_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_type VARCHAR(20) NOT NULL,
  business_id BIGINT UNSIGNED NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  action VARCHAR(30) NOT NULL,
  previous_status VARCHAR(100) NOT NULL,
  next_status VARCHAR(100) NOT NULL,
  reason_ids JSON NOT NULL,
  reason_snapshot JSON NOT NULL,
  additional_note VARCHAR(500) NOT NULL DEFAULT '',
  business_snapshot JSON NOT NULL,
  operator_id INT NOT NULL,
  operator_name_snapshot VARCHAR(100) NOT NULL,
  operator_role_snapshot VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_enforcement_business (business_type, business_id, created_at),
  KEY idx_enforcement_merchant (merchant_id, created_at),
  KEY idx_enforcement_operator (operator_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO vueshop_rejection_reason (scene, label, sort_order) VALUES
('goods_enforcement', '商品描述与实际不符', 10),
('goods_enforcement', '商品图片或宣传内容违规', 20),
('goods_enforcement', '销售禁售或限制销售商品', 30),
('goods_enforcement', '涉嫌假冒伪劣或侵权', 40),
('goods_enforcement', '价格或交易行为异常', 50),
('goods_enforcement', '其他原因', 100),
('merchant_enforcement', '店铺资质信息异常', 10),
('merchant_enforcement', '销售禁售或违规商品', 20),
('merchant_enforcement', '多次违反平台规则', 30),
('merchant_enforcement', '涉嫌欺诈或侵权', 40),
('merchant_enforcement', '拒不整改', 50),
('merchant_enforcement', '其他原因', 100);
