ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_zone_id bigint(20) unsigned DEFAULT NULL
  AFTER shipping_method_id;
