-- 第 6 个数据库变更：允许同一用户申请和管理多个店铺
-- 请在 005_create_merchant_review.sql 执行完成后运行本文件

ALTER TABLE vueshop_merchant
  DROP INDEX uk_merchant_user;
