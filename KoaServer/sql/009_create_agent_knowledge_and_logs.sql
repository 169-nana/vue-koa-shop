-- 第 9 个数据库变更：顾客智能体知识库与调用日志

CREATE TABLE IF NOT EXISTS vueshop_agent_knowledge (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  keywords VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_agent_knowledge_title (category, title),
  KEY idx_agent_knowledge_enabled (enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO vueshop_agent_knowledge
  (category, title, keywords, content, sort_order)
VALUES
  ('delivery', '配送与运费', '配送,物流,运费,发货,送达', '具体配送范围、运费和预计送达时间以订单结算页显示为准。下单后可在订单详情查看物流信息。', 10),
  ('after_sale', '七天无理由退货', '七天无理由,退货,换货,售后', '是否支持七天无理由退货以商品详情和实际售后规则为准。定制、易耗或影响二次销售的商品可能不适用。', 20),
  ('refund', '退款到账', '退款,到账,原路退回', '退款审核通过后将原路退回，实际到账时间由支付渠道决定。顾客可在售后页面查看最新进度。', 30),
  ('coupon', '优惠券使用', '优惠券,优惠,满减,折扣', '优惠券的适用商品、最低消费、有效期和叠加规则以优惠券页面及结算页显示为准。', 40),
  ('payment', '支付问题', '支付,付款,失败,重复扣款', '支付状态以订单页面为准。如遇重复扣款或长时间状态未更新，请保留支付凭证并联系人工客服。', 50);

CREATE TABLE IF NOT EXISTS vueshop_agent_call_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  request_key_hash CHAR(64) NOT NULL,
  model VARCHAR(80) NOT NULL,
  success TINYINT NOT NULL,
  duration_ms INT UNSIGNED NOT NULL,
  prompt_chars INT UNSIGNED NOT NULL,
  response_chars INT UNSIGNED NOT NULL DEFAULT 0,
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agent_log_user (user_id, created_at),
  KEY idx_agent_log_created (created_at),
  KEY idx_agent_log_success (success, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
