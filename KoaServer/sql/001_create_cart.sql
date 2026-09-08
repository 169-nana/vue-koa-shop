-- 第 1 个数据库变更：创建购物车表
-- 执行前请确认当前连接的是开发数据库

CREATE TABLE IF NOT EXISTS vueshop_cart (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  goods_id INT NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_cart_user_goods (user_id, goods_id),
  KEY idx_cart_user_id (user_id),
  KEY idx_cart_goods_id (goods_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
