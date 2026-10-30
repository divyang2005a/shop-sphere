
# ShopSphere Backend

ShopSphere is an e-commerce backend built with Node.js, Express.js and MySQL/MariaDB. It provides APIs for authentication, product catalog management, cart and wishlist operations, checkout, orders, customer support and admin operations.

## 1. Technology Stack

- Node.js
- Express.js
- MySQL / MariaDB
- mysql2
- JSON Web Token (JWT)
- bcryptjs
- Nodemailer
- Multer
- PDFKit
- Helmet
- express-rate-limit

## 2. Project Structure

```text
backend/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── uploads/
├── utils/
├── .env
├── .env.example
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

## 3. Prerequisites

Install or prepare the following:

- Node.js and npm
- XAMPP for Linux, including MySQL/MariaDB
- VS Code or another code editor
- Postman for API testing

## 4. Start the Database

On Arch Linux with XAMPP installed, start XAMPP:

```bash
sudo /opt/lampp/xampp start
```

If only the database service is needed, the following command can also be used:

```bash
sudo /opt/lampp/lampp startmysql
```

Make sure the MySQL/MariaDB service is running before starting the backend.

## 5. Database Configuration

The backend uses the `shop_sphere` database.

Create the database and import the project's database schema before running the APIs. Import any provided schema SQL file through phpMyAdmin or the MySQL command line.

Example command (replace the file path with the actual schema file path):

```bash
/opt/lampp/bin/mysql -u root -D shop_sphere < /path/to/schema.sql
```

If the database account has a password, use the appropriate secure authentication method for your local setup.

**Important:** Keep the schema and seed SQL files with the project so that another developer can recreate the database. Confirm that required tables and initial data are present before testing APIs.

For an existing database, apply the coupon user-limit migration once before
starting the updated backend:

```bash
/opt/lampp/bin/mysql -u root -D shop_sphere < database/migrations/20261027_add_coupon_user_limit.sql
```

For an existing database, apply the site reviews migration once before using
the site review endpoints:

```bash
/opt/lampp/bin/mysql -u root -D shop_sphere < database/migrations/20261028_add_site_reviews.sql
```

For an existing database, apply this migration to allow product reviews from
customers without a delivered purchase:

```bash
/opt/lampp/bin/mysql -u root -D shop_sphere < database/migrations/20261028_allow_unverified_product_reviews.sql
```

For an existing database, apply the notification campaigns migration before
using admin notification campaigns or scheduled notifications:

```bash
/opt/lampp/bin/mysql -u root -D shop_sphere < database/migrations/20261030_create_notification_campaigns.sql
```

Coupon creation accepts an optional `user_limit` integer. It limits the number
of distinct users who can redeem that coupon; once reached, the coupon is
automatically marked inactive. The admin coupon list returns `user_count` and
`user_limit`.

## 6. Environment Configuration

Create your local `.env` file from the example:

```bash
cd ~/shop_sphere/backend
cp .env.example .env
```

Open `.env` and configure the values for your own environment.

Required variables:

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port |
| `NODE_ENV` | Environment, such as development |
| `DB_HOST` | Database host |
| `DB_PORT` | Database port |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | Secret used to sign and verify JWTs |
| `JWT_EXPIRES_IN` | JWT expiration setting |
| `SMTP_HOST` | SMTP email server |
| `SMTP_PORT` | SMTP port |
| `SMTP_SECURE` | Whether SMTP uses implicit TLS |
| `SMTP_USER` | SMTP account username |
| `SMTP_PASSWORD` | SMTP account password or app password |
| `SMTP_FROM` | Sender address for emails |

Replace all example placeholders with appropriate values. Use a strong, unique `JWT_SECRET` and working SMTP credentials.

Never commit `.env` or real credentials to version control.

## 7. Install Dependencies

From the backend directory, run:

```bash
cd ~/shop_sphere/backend
npm install
```

## 8. Start the Backend

Run:

```bash
node server.js
```

The backend uses port `5000` by default unless `PORT` is configured differently.

Base URL:

```text
http://localhost:5000
```

The server also verifies the SMTP connection during startup.

To stop the development server, press `Ctrl+C` in its terminal.

## 9. API Route Groups

The backend mounts the following API route groups:

| Route prefix | Purpose |
|---|---|
| `/api/auth` | Registration, login, OTP verification, password management and customer profile |
| `/api/products` | Product catalog and product details |
| `/api/admin` | Administrative operations, product/category/brand management, orders and other admin functions |
| `/api/cart` | Shopping cart operations |
| `/api/addresses` | Customer address management |
| `/api/orders` | Checkout, order creation, order history, cancellation, tracking, returns and invoice access |
| `/api/payment-methods` | Active payment methods available at checkout |
| `/api/wishlist` | Wishlist operations |
| `/api/reviews` | Product reviews |
| `/api/notifications` | Customer notifications |
| `/api/shipments` | Shipment records and tracking |
| `/api/shipping` | Active shipping methods and delivery areas |
| `/api/support` | Customer support tickets and messages |

Payment methods are configurable without a payment gateway. Apply the migration
once to an existing database:

```bash
/opt/lampp/bin/mysql -u root -D shop_sphere < database/migrations/20261027_add_payment_methods.sql
```

Admins can manage methods with `GET` and `POST /api/admin/payment-methods`
and `PATCH /api/admin/payment-methods/:id`. Customers can fetch active methods
from `GET /api/payment-methods`; the checkout summary also includes
`available_payment_methods`. Pass the selected `payment_method_id` when
creating an order to save the method name on that order. Orders remain pending;
this feature does not process or confirm payments.

Admins can manage shipping methods and delivery areas through
`/api/admin/shipping-methods` and `/api/admin/delivery-areas`. Public
authenticated endpoints are `GET /api/shipping/methods` and
`GET /api/shipping/delivery-areas`. Delivery areas contain a list of pincodes,
a shipping fee, and an optional free-shipping threshold. For existing
databases, apply `database/migrations/20261027_add_shipping_zone_to_orders.sql`
once. Checkout accepts only addresses in an active delivery area when a
shipping method is selected.

Create a shipping method with `POST /api/admin/shipping-methods`:

```json
{
  "name": "Standard Delivery",
  "description": "Standard shipping",
  "price": 50,
  "estimated_days": "3-5 days"
}
```

Create a delivery area with `POST /api/admin/delivery-areas`:

```json
{
  "name": "Central region",
  "pincodes": ["110001", "110002"],
  "shipping_fee": 50,
  "free_shipping_threshold": 1000
}
```

Use the admin bearer token for admin endpoints. Active areas cannot share
pincodes; deactivate an area with `PATCH /api/admin/delivery-areas/:id` and
`{"status":"inactive"}`.

Example admin request to add a method:

```json
{
  "code": "cod",
  "name": "Cash on Delivery",
  "description": "Pay when the order is delivered",
  "sort_order": 1
}
```

The root endpoint can be checked with:

```text
GET http://localhost:5000/
```

It should return a successful response when the server is running.

## 10. Authentication

Protected routes require a valid JWT in the request header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

Administrative routes also use role-based authorization. Use the appropriate customer or admin account when testing protected endpoints.

Sensitive authentication endpoints have rate limiting configured. Requests exceeding the configured limit may receive HTTP `429 Too Many Requests`.

## 11. File Uploads

Uploaded files are stored under the backend's `uploads/` directory, including product images, category images, brand logos and profile images.

Static files are served under:

```text
http://localhost:5000/uploads/
```

Only upload files of the types and sizes permitted by the relevant upload middleware.

## 12. Email and PDF Features

The backend uses Nodemailer for email functionality and PDFKit for generated documents.

Email functionality requires valid SMTP settings. PDF endpoints should be tested with suitable existing records and the required authentication.

## 13. Testing

Use Postman to test endpoints with valid request bodies and authorization tokens.

Check successful responses, validation errors, unauthorized requests and relevant failure cases.

Run JavaScript syntax checks on modified files when appropriate:

```bash
node --check server.js
node --check routes/authRoutes.js
```

The `npm test` script must be configured with an automated test runner and actual test cases before it can be used for automated testing.

## 14. Security Notes

- Passwords should be stored using secure password hashing.
- Keep JWT and SMTP secrets private.
- Use authentication and role authorization on protected endpoints.
- Validate request data on the server.
- Use parameterized database queries.
- Apply rate limiting to sensitive endpoints.
- Retain security headers and configure CORS for the intended frontend origin.
- Avoid logging passwords, OTPs, tokens or other sensitive information.
- Review audit logging for important administrative actions.

## 15. Current Scope Notes

- Payment gateway integration is outside the current project scope.
- Shipment tracking is implemented through the project's shipment functionality; do not assume a live third-party courier integration.
- Keep database schema, seed data, API documentation, environment examples and test instructions in the project deliverables.
