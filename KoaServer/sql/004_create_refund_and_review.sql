-- 第 4 个数据库变更：售后退款申请与商品评价
-- 请在 001、002、003 执行完成后运行本文件

CREATE TABLE IF NOT EXISTS vueshop_order_refund (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  refund_amount DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refund_order_id (order_id),
  KEY idx_refund_user_id (user_id),
  KEY idx_refund_user_status (user_id, status),
  CONSTRAINT fk_refund_order
    FOREIGN KEY (order_id) REFERENCES vueshop_order(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_goods_review (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  goods_id INT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  content VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_review_order_item (order_item_id),
  KEY idx_review_goods_id (goods_id),
  KEY idx_review_user_id (user_id),
  CONSTRAINT fk_review_order_item
    FOREIGN KEY (order_item_id) REFERENCES vueshop_order_item(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
