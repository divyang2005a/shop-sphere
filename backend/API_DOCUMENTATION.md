cd ~/shop_sphere/backend

cat > API_DOCUMENTATION.md <<'EOF'
# ShopSphere Backend API Documentation

## 1. Overview

ShopSphere is an e-commerce backend built with Node.js, Express.js and MySQL/MariaDB.

Base URL for local development:

`http://localhost:5000`

All paths in this document are relative to the base URL.

## 2. Authentication

Protected endpoints require a valid JWT access token:

`Authorization: Bearer YOUR_JWT_TOKEN`

Admin endpoints require authentication and admin-role authorization.

Authentication endpoints include registration, login, login OTP verification, password reset and password change. Sensitive authentication endpoints are configured with rate limiting.

Do not share JWT tokens, passwords, OTPs, SMTP credentials or database credentials.

## 3. Common Conventions

- HTTP methods describe the operation: GET, POST, PUT, PATCH or DELETE.
- Path parameters such as `:productId` must be replaced with actual resource identifiers.
- JSON request bodies should use `Content-Type: application/json` unless an endpoint accepts a file upload.
- File-upload endpoints use the relevant multipart form-data field.
- Request-body fields, validation rules and response properties are defined by the corresponding controller.
- Response formats and status codes can vary by endpoint.

## 4. Authentication and Customer Profile

Prefix: `/api/auth`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/register` | Register a customer |
| POST | `/login` | Log in |
| POST | `/logout` | Log out |
| POST | `/verify-otp` | Verify login OTP |
| POST | `/forgot-password` | Start password recovery |
| POST | `/reset-password` | Reset password |
| PUT | `/change-password` | Change the logged-in user's password |
| GET | `/profile` | Get the logged-in user's profile |
| PUT | `/profile` | Update the profile; supports the `profile_image` upload field |

Rate limiting is configured for registration, login, OTP verification, password recovery, password reset and password change.

## 5. Product Catalog

Prefix: `/api/products`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | List products |
| GET | `/:productId` | Get product details, including its images |

The product listing and detail routes do not declare authentication middleware in the route definitions.

## 6. Customer Addresses

Prefix: `/api/addresses`

All listed endpoints require authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/` | Add an address |
| GET | `/` | List the customer's addresses |
| PUT | `/:addressId` | Update an address |
| DELETE | `/:addressId` | Delete an address |

## 7. Shopping Cart

Prefix: `/api/cart`

All listed endpoints require authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Get the cart |
| POST | `/` | Add an item to the cart |
| PUT | `/:itemId` | Update a cart item |
| DELETE | `/clear` | Clear the cart |
| DELETE | `/:itemId` | Remove a cart item |

## 8. Wishlist

Prefix: `/api/wishlist`

All listed endpoints require authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Get the wishlist |
| POST | `/items` | Add an item to the wishlist |
| POST | `/items/:itemId/move-to-cart` | Move a wishlist item to the cart |
| DELETE | `/items/:itemId` | Remove a wishlist item |

## 9. Checkout and Customer Orders

Prefix: `/api/orders`

All listed endpoints require authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/` | Create an order |
| GET | `/` | List the customer's orders |
| GET | `/checkout-summary` | Get checkout summary |
| GET | `/refunds` | Get the customer's refunds |
| GET | `/credit-notes/:creditNoteId/pdf` | Get a credit note PDF |
| POST | `/:orderId/reorder` | Reorder an existing order |
| GET | `/:orderId` | Get order details |
| PATCH | `/:orderId/cancel` | Cancel an order |
| GET | `/:orderId/track` | Track an order |
| POST | `/:orderId/return` | Request an order return |
| GET | `/:orderId/invoice` | Get invoice information |
| GET | `/:orderId/invoice/pdf` | Download or generate an invoice PDF |

Keep static routes such as `/checkout-summary` and `/refunds` before the `/:orderId` route in the router.

When an order is successfully placed, the backend creates one pending shipment
and its initial tracking-history event in the same database transaction. The
order response includes `shipment_id` and `shipment_status`. Admins can add
courier/tracking details and update its status through the shipment APIs.

Payment gateway integration is outside the current project scope. Refund endpoints must be tested only with legitimate existing records and applicable business rules.

## 10. Product Reviews

Prefix: `/api/reviews`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/` | Create a product review; authentication required |
| GET | `/my` | List the logged-in customer's reviews; authentication required |
| GET | `/product/:productId` | Get reviews for a product |
| GET | `/admin` | Get reviews for administration; authentication and admin authorization required |
| PATCH | `/admin/:reviewId/status` | Moderate a review; authentication and admin authorization required |

## 11. Notifications

Prefix: `/api/notifications`

All listed endpoints require authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | List the customer's notifications |
| GET | `/unread-count` | Get unread notification count |
| PATCH | `/read-all` | Mark all notifications as read |
| PATCH | `/:notificationId/read` | Mark one notification as read |

## 12. Shipments and Tracking

Prefix: `/api/shipments`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin` | List all shipments with order, customer, address, shipping-method and tracking-history details; authentication and admin authorization required |
| GET | `/admin/:shipmentId` | Get a shipment with complete order and tracking-history details; authentication and admin authorization required |
| POST | `/admin/orders/:orderId` | Create a shipment; authentication and admin authorization required |
| PATCH | `/admin/:shipmentId/status` | Update shipment status; authentication and admin authorization required |
| GET | `/orders/:orderId` | Get order shipments; authentication required |
| GET | `/tracking/:trackingNumber` | Get a shipment by tracking number; authentication required |

Shipment tracking uses the application's shipment functionality. A live third-party courier integration should not be assumed.

## Shipping Methods and Delivery Areas

Public authenticated endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/shipping/methods` | List active shipping methods |
| GET | `/api/shipping/delivery-areas` | List active delivery areas; optional `?pincode=...` filters the list |

Admin-only endpoints under `/api/admin`:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/shipping-methods` | List shipping methods |
| POST | `/shipping-methods` | Create a shipping method |
| PATCH | `/shipping-methods/:id` | Update a shipping method or deactivate it |
| GET | `/delivery-areas` | List delivery areas |
| POST | `/delivery-areas` | Create a delivery area with pincodes and fee rules |
| PATCH | `/delivery-areas/:id` | Update a delivery area or deactivate it |

Checkout requires the selected shipping address pincode to match one active
delivery area. The area's shipping fee applies, with free shipping at or above
its optional threshold. For existing databases, apply
`database/migrations/20261027_add_shipping_zone_to_orders.sql` once.

Shipping method requests accept both database fields (`description`, `price`,
`estimated_days`) and frontend aliases (`type`, `charge`, `deliveryTime`).
Delivery-area requests accept `pincodes` or `pincode`, and `shipping_fee` or
`charge`. Since `shipping_zones` has no city, state, or estimated-days columns,
the frontend should combine city and state into `name`; estimated delivery
belongs to the selected shipping method. Responses retain database fields and
include frontend aliases where applicable.

Admin create examples:

```json
{
  "name": "Standard Delivery",
  "description": "Standard shipping",
  "price": 50,
  "estimated_days": "3-5 days"
}
```

```json
{
  "name": "Central region",
  "pincodes": ["110001", "110002"],
  "shipping_fee": 50,
  "free_shipping_threshold": 1000
}
```

## 13. Customer Support

Prefix: `/api/support`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/tickets` | List support tickets for admins; admin authorization required |
| GET | `/admin/tickets/:ticketId` | Get ticket details for admins; admin authorization required |
| POST | `/admin/tickets/:ticketId/messages` | Admin replies to a ticket; admin authorization required |
| PATCH | `/admin/tickets/:ticketId/status` | Update ticket status; admin authorization required |
| POST | `/` | Create a support ticket; authentication required |
| GET | `/` | List the customer's tickets; authentication required |
| GET | `/:ticketId` | Get a customer's ticket details; authentication required |
| POST | `/:ticketId/messages` | Send a customer message; authentication required |

## 14. Admin APIs

Prefix: `/api/admin`

All endpoints in this section require authentication and admin-role authorization.

### Dashboard and Users

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Get admin dashboard status |
| GET | `/users` | List users |
| PUT | `/users/:id/status` | Update a user's status |

### Products

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/products` | List products for administration |
| POST | `/products` | Create a product |
| PUT | `/products/:product_id` | Update a product |
| DELETE | `/products/:product_id` | Delete a product |

### Product Images

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/products/:product_id/images` | List a product's images |
| POST | `/products/:product_id/images` | Add an image using multipart field `image` |
| DELETE | `/products/:product_id/images/:image_id` | Delete a product image |

### Product Variants

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/products/:product_id/variants` | List product variants |
| POST | `/products/:product_id/variants` | Create a product variant |
| PUT | `/products/:product_id/variants/:variant_id` | Update a product variant |
| DELETE | `/products/:product_id/variants/:variant_id` | Delete a product variant |

### Returns

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/returns` | List return requests |
| PUT | `/returns/:return_id` | Update a return request's status |
| POST | `/returns/:return_id/credit-note` | Create a credit note |
| POST | `/returns/:return_id/refund` | Initiate the application's refund workflow |

### Categories

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/categories` | List categories |
| POST | `/categories` | Create a category; multipart field `image` is accepted |
| PUT | `/categories/:id` | Update a category; multipart field `image` is accepted |
| DELETE | `/categories/:id` | Delete a category |

### Brands

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/brands` | List brands |
| POST | `/brands` | Create a brand; see route definition for accepted upload fields |
| PUT | `/brands/:id` | Update a brand; see route definition for accepted upload fields |
| DELETE | `/brands/:id` | Delete a brand |

### Inventory

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/inventory/movements` | List inventory movements |
| POST | `/inventory/movements` | Create an inventory movement |
| PUT | `/inventory/:product_id` | Update product inventory |

### GST Rates

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/gst-rates` | List GST rates |

### Admin Order Management

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/orders` | List orders for administration |
| GET | `/orders/:order_id` | Get an order for administration |
| PATCH | `/orders/:order_id/status` | Update order status |
| GET | `/orders/:order_id/invoice` | Get an order's invoice |
| GET | `/orders/:order_id/invoice/pdf` | Generate or download the invoice PDF |
| GET | `/orders/:order_id/packing-slip/pdf` | Generate or download the packing slip PDF |

### Credit Notes and Refunds

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/credit-notes` | List credit notes |
| GET | `/credit-notes/:creditNoteId/pdf` | Get a credit note PDF |
| GET | `/refunds` | List refunds |
| PATCH | `/refunds/:refund_id/status` | Update refund status |

## 15. Uploads and Static Files

Uploaded files are served from the `/uploads` URL prefix.

Example:

`http://localhost:5000/uploads/profile/example.jpg`

The actual stored filename and subdirectory depend on the relevant upload middleware. Use the path returned by the API.

## 16. Security

- Keep credentials and private configuration in `.env`, not in committed source code.
- Use JWT authentication on protected endpoints.
- Use admin authorization for administrative endpoints.
- Sensitive authentication endpoints have rate limits configured.
- Helmet is configured to provide HTTP security headers.
- CORS is configured for the intended frontend origin.
- SQL access uses parameterized queries in the inspected profile and audit implementations.
- Admin write actions are recorded in `admin_audit_logs` by the audit middleware. Old values are not yet populated by the generic middleware.
- Do not include passwords, OTPs, tokens or credentials in logs or documentation.

## 17. Testing Checklist

Use Postman or another HTTP client to verify:

1. Public product listing and product detail.
2. Registration, login and OTP verification.
3. Unauthorized access to protected endpoints.
4. Customer profile and address operations.
5. Cart and wishlist operations.
6. Checkout summary and order lifecycle.
7. Invoice, packing slip and credit note documents.
8. Admin-only authorization.
9. Rate-limit behavior on sensitive authentication routes.
10. Admin audit entries after successful write actions.
11. Upload validation and file access.
12. Validation errors and missing resource responses.

The project must include real automated test cases before `npm test` can be considered functional.

## 18. Database Schema and Seed Data

The database used by the application is `shop_sphere`.

The current project should include reproducible SQL schema and seed files. If these files are stored outside this backend directory, copy the appropriate, verified files into the project deliverables and document their import order. Do not generate replacement seed data that conflicts with existing records.

## 19. Scope

Payment gateway integration is excluded from the current project scope. Do not represent a pending or unpaid order as a successful payment. Do not create fake payment records to test refunds.

Payment method options may be stored and selected for an order without processing
a payment. The selected method is saved with the order, while its payment status
remains pending until an actual payment is recorded.
EOF