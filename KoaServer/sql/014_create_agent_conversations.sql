-- 第 14 个数据库变更：智能体多会话与结构化商品上下文

CREATE TABLE IF NOT EXISTS vueshop_agent_conversation (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(60) NOT NULL DEFAULT '新对话',
  context JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agent_conversation_user (user_id, updated_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE vueshop_agent_chat_message
  ADD COLUMN conversation_id BIGINT UNSIGNED NULL AFTER user_id;

INSERT INTO vueshop_agent_conversation (user_id, title, created_at, updated_at)
SELECT user_id, '历史对话', MIN(created_at), MAX(created_at)
FROM vueshop_agent_chat_message
GROUP BY user_id;

UPDATE vueshop_agent_chat_message AS message
JOIN (
  SELECT user_id, MIN(id) AS conversation_id
  FROM vueshop_agent_conversation
  GROUP BY user_id
) AS conversation ON conversation.user_id = message.user_id
SET message.conversation_id = conversation.conversation_id
WHERE message.conversation_id IS NULL;

ALTER TABLE vueshop_agent_chat_message
  MODIFY COLUMN conversation_id BIGINT UNSIGNED NOT NULL,
  DROP INDEX idx_agent_chat_user_id,
  ADD KEY idx_agent_chat_conversation_id (user_id, conversation_id, id);
