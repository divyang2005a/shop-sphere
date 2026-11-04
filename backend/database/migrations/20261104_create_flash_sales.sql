CREATE TABLE IF NOT EXISTS `flash_sales` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `sale_price` decimal(12,2) NOT NULL,
  `stock_limit` int(10) unsigned NOT NULL,
  `sold_quantity` int(10) unsigned NOT NULL DEFAULT 0,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_flash_sales_active_window` (`status`, `start_time`, `end_time`),
  KEY `idx_flash_sales_product` (`product_id`),
  CONSTRAINT `fk_flash_sales_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
