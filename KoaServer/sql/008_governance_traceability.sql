-- 在 007 之后执行；不回填无法可靠还原的历史关联。
ALTER TABLE vueshop_enforcement_record
  ADD COLUMN parent_record_id BIGINT UNSIGNED NULL,
  ADD KEY idx_enforcement_parent (parent_record_id, id),
  ADD KEY idx_enforcement_action (action, id);
ALTER TABLE vueshop_review_record
  ADD COLUMN enforcement_record_id BIGINT UNSIGNED NULL,
  ADD COLUMN record_source VARCHAR(30) NOT NULL DEFAULT 'manual',
  ADD KEY idx_review_enforcement (enforcement_record_id, id),
  ADD KEY idx_review_decision (decision, id);

ALTER TABLE vueshop_goods ADD COLUMN governance_version INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE vueshop_merchant ADD COLUMN governance_version INT UNSIGNED NOT NULL DEFAULT 0;
