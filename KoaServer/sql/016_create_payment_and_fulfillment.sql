-- 支付、履约、退款资金流水和订单时间轴。
ALTER TABLE vueshop_order
  ADD COLUMN payment_expires_at DATETIME NULL AFTER receiver_address,
  ADD COLUMN paid_at DATETIME NULL AFTER payment_expires_at,
  ADD COLUMN shipped_at DATETIME NULL AFTER paid_at,
  ADD COLUMN completed_at DATETIME NULL AFTER shipped_at,
  ADD COLUMN cancelled_at DATETIME NULL AFTER completed_at,
  ADD KEY idx_order_expiry (status, payment_expires_at);

UPDATE vueshop_order
SET payment_expires_at = DATE_ADD(created_at, INTERVAL 30 MINUTE)
WHERE status = 'pending' AND payment_expires_at IS NULL;

ALTER TABLE vueshop_order_item
  ADD COLUMN merchant_id BIGINT UNSIGNED NULL AFTER goods_id,
  ADD COLUMN merchant_name VARCHAR(100) NULL AFTER merchant_id,
  ADD COLUMN fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER subtotal,
  ADD COLUMN shipping_carrier VARCHAR(100) NOT NULL DEFAULT '' AFTER fulfillment_status,
  ADD COLUMN tracking_no VARCHAR(100) NOT NULL DEFAULT '' AFTER shipping_carrier,
  ADD COLUMN shipped_at DATETIME NULL AFTER tracking_no,
  ADD KEY idx_order_item_merchant (merchant_id, order_id),
  ADD KEY idx_order_item_fulfillment (order_id, fulfillment_status);

UPDATE vueshop_order_item AS i
LEFT JOIN vueshop_goods AS g ON g.id = i.goods_id
LEFT JOIN vueshop_merchant AS m ON m.id = g.merchant_id
SET i.merchant_id = g.merchant_id, i.merchant_name = m.shop_name;

CREATE TABLE IF NOT EXISTS vueshop_payment_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_no VARCHAR(40) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  provider VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider_transaction_id VARCHAR(100) NULL,
  expires_at DATETIME NOT NULL,
  paid_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_no (payment_no),
  UNIQUE KEY uk_payment_order_provider (order_id, provider),
  UNIQUE KEY uk_payment_provider_transaction (provider, provider_transaction_id),
  KEY idx_payment_user (user_id, id),
  KEY idx_payment_expiry (status, expires_at),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES vueshop_order(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_payment_callback (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(20) NOT NULL,
  event_id VARCHAR(100) NOT NULL,
  payment_no VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_callback_event (provider, event_id),
  KEY idx_payment_callback_no (payment_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_refund_transaction (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  refund_no VARCHAR(40) NOT NULL,
  refund_application_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider_refund_id VARCHAR(100) NULL,
  succeeded_at DATETIME NULL,
  failure_reason VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refund_no (refund_no),
  UNIQUE KEY uk_refund_application (refund_application_id),
  KEY idx_refund_payment (payment_id),
  CONSTRAINT fk_refund_transaction_application FOREIGN KEY (refund_application_id)
    REFERENCES vueshop_order_refund(id),
  CONSTRAINT fk_refund_transaction_payment FOREIGN KEY (payment_id)
    REFERENCES vueshop_payment_order(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
