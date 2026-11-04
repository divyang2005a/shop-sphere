ALTER TABLE `banners`
  ADD COLUMN `placement` varchar(20) NOT NULL DEFAULT 'hero' AFTER `end_date`;
