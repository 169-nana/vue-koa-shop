-- 第 3 个数据库变更：地址簿，以及购物车选择的规格和地址
-- 请在 001、002 执行完成后运行本文件

CREATE TABLE IF NOT EXISTS vueshop_user_address (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  receiver_name VARCHAR(50) NOT NULL,
  receiver_phone VARCHAR(20) NOT NULL,
  receiver_address VARCHAR(255) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_address_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE vueshop_cart
  ADD COLUMN selected_spec VARCHAR(255) NOT NULL DEFAULT '' AFTER quantity,
  ADD COLUMN address_id BIGINT UNSIGNED NULL AFTER selected_spec,
  DROP INDEX uk_cart_user_goods,
  ADD UNIQUE KEY uk_cart_user_goods_spec (user_id, goods_id, selected_spec),
  ADD KEY idx_cart_address_id (address_id);
