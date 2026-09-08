-- 第 2 个数据库变更：创建订单主表和订单明细表
-- 执行前请确认当前连接的是开发数据库

CREATE TABLE IF NOT EXISTS vueshop_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL,
  user_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  receiver_name VARCHAR(50) NOT NULL,
  receiver_phone VARCHAR(20) NOT NULL,
  receiver_address VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_order_user_id (user_id),
  KEY idx_order_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  goods_id INT NOT NULL,
  goods_name VARCHAR(255) NOT NULL,
  goods_picture VARCHAR(255) NOT NULL DEFAULT '',
  goods_spec VARCHAR(255) NOT NULL DEFAULT '',
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_item_order_id (order_id),
  CONSTRAINT fk_order_item_order
    FOREIGN KEY (order_id)
    REFERENCES vueshop_order(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
