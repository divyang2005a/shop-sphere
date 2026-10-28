ALTER TABLE coupons
  ADD COLUMN user_limit int(11) DEFAULT NULL AFTER usage_limit;
