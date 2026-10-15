-- 第 15 个数据库变更：会话并发保护与确认动作历史恢复

ALTER TABLE vueshop_agent_conversation
  ADD COLUMN revision BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER context;

ALTER TABLE vueshop_agent_action
  ADD COLUMN conversation_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD COLUMN request_id CHAR(36) NULL AFTER conversation_id,
  ADD COLUMN title VARCHAR(160) NOT NULL DEFAULT '' AFTER payload,
  ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT '' AFTER title,
  ADD KEY idx_agent_action_conversation (user_id, conversation_id, created_at),
  ADD KEY idx_agent_action_request (request_id);
