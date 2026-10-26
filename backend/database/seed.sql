-- ============================================
-- ShopSphere reference / initial seed data
-- Safe to run repeatedly against the same schema.
-- Does not create sample users, orders or payments.
-- ============================================

START TRANSACTION;

-- ============================================
-- ROLES
-- ============================================

INSERT INTO roles (name, description)
VALUES
  ('admin', 'ShopSphere administrator'),
  ('user', 'Normal customer role')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- ============================================
-- PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description)
VALUES
  ('manage_users', 'Manage users'),
  ('manage_products', 'Manage products'),
  ('manage_orders', 'Manage orders'),
  ('manage_categories', 'Manage categories'),
  ('manage_coupons', 'Manage coupons'),
  ('manage_reviews', 'Manage reviews'),
  ('manage_support', 'Manage support'),
  ('view_reports', 'View reports')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- ============================================
-- GST RATES
-- Insert only when the HSN code is not present.
-- ============================================

INSERT INTO gst_rates
  (hsn_code, description, gst_percentage, status)
SELECT
  'GST00000', 'GST 0 percent option', 0.00, 1
WHERE NOT EXISTS (
  SELECT 1 FROM gst_rates WHERE hsn_code = 'GST00000'
);

INSERT INTO gst_rates
  (hsn_code, description, gst_percentage, status)
SELECT
  'GST00005', 'GST 5 percent option', 5.00, 1
WHERE NOT EXISTS (
  SELECT 1 FROM gst_rates WHERE hsn_code = 'GST00005'
);

INSERT INTO gst_rates
  (hsn_code, description, gst_percentage, status)
SELECT
  'GST00012', 'GST 12 percent option', 12.00, 1
WHERE NOT EXISTS (
  SELECT 1 FROM gst_rates WHERE hsn_code = 'GST00012'
);

INSERT INTO gst_rates
  (hsn_code, description, gst_percentage, status)
SELECT
  'GST00018', 'GST 18 percent option', 18.00, 1
WHERE NOT EXISTS (
  SELECT 1 FROM gst_rates WHERE hsn_code = 'GST00018'
);

INSERT INTO gst_rates
  (hsn_code, description, gst_percentage, status)
SELECT
  'GST00028', 'GST 28 percent option', 28.00, 1
WHERE NOT EXISTS (
  SELECT 1 FROM gst_rates WHERE hsn_code = 'GST00028'
);

-- ============================================
-- DEFAULT SHIPPING METHOD
-- Insert only when the method name is not present.
-- ============================================

INSERT INTO shipping_methods
  (name, description, price, estimated_days, status)
SELECT
  'Standard Delivery',
  'Standard shipping',
  50.00,
  '3-5 days',
  'active'
WHERE NOT EXISTS (
  SELECT 1
  FROM shipping_methods
  WHERE name = 'Standard Delivery'
);

COMMIT;
