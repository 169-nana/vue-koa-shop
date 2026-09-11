-- 第 10 个数据库变更：智能体一次性确认动作

CREATE TABLE IF NOT EXISTS vueshop_agent_action (
  id CHAR(36) NOT NULL,
  user_id INT NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'prepared',
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  expires_at DATETIME NOT NULL,
  executed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agent_action_user (user_id, created_at),
  KEY idx_agent_action_expiry (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vueshop_agent_conversion_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  request_key_hash CHAR(64) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  goods_id INT NULL,
  action_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agent_event_type (event_type, created_at),
  KEY idx_agent_event_goods (goods_id, created_at),
  KEY idx_agent_event_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
