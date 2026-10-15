-- 第 13 个数据库变更：登录顾客的智能体聊天历史与游标分页

CREATE TABLE IF NOT EXISTS vueshop_agent_chat_message (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  request_id CHAR(36) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_agent_chat_request_role (request_id, role),
  KEY idx_agent_chat_user_id (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
