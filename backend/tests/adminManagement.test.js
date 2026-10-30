const assert = require("node:assert/strict");
const test = require("node:test");

const calls = [];
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    promise: () => ({
      execute: async (sql, params = []) => {
        calls.push({ sql, params });
        if (sql.includes("COUNT(*) AS total FROM admin_audit_logs")) {
          return [[{ total: 1 }]];
        }
        if (sql.includes("FROM admin_audit_logs l")) {
          return [[{ id: 8, admin_id: 3, action: "PUT /api/admin/settings/:id" }]];
        }
        if (sql.includes("COUNT(ur.user_id)")) {
          return [[{ id: 1, name: "admin", assigned_users: "1" }]];
        }
        if (sql.includes("SELECT id, name, email FROM users")) {
          return [[{ id: 3, name: "Admin", email: "admin@example.test" }]];
        }
        if (sql.includes("FROM user_roles ur")) {
          return [[{ id: 1, name: "admin", description: "Administrator" }]];
        }
        if (sql.includes("SELECT start_date, end_date FROM banners")) {
          return [[{ start_date: "2026-01-01 00:00:00", end_date: "2027-01-01 00:00:00" }]];
        }
        if (sql.includes("FROM banners")) {
          return [[{ id: 1, title: "Main", image: "/uploads/banners/main.png" }]];
        }
        if (sql.includes("FROM settings")) {
          return [[{ id: 1, key: "store_name", value: "ShopSphere" }]];
        }
        if (sql.startsWith("INSERT INTO banners")) {
          return [{ insertId: 10, affectedRows: 1 }];
        }
        if (sql.startsWith("INSERT INTO settings")) {
          return [{ insertId: 11, affectedRows: 1 }];
        }
        if (sql.startsWith("UPDATE banners")) {
          return [{ affectedRows: 1 }];
        }
        throw new Error(`Unexpected SQL in admin management test: ${sql}`);
      },
    }),
  },
};

const content = require("../controllers/adminContentController");
const audit = require("../controllers/adminAuditController");
const roles = require("../controllers/adminRoleController");

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("admin banner API lists records and creates with an uploaded banner image", async () => {
  calls.length = 0;
  const listed = makeResponse();
  await content.getBanners({}, listed);
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.banners.length, 1);
  assert.match(calls[0].sql, /FROM banners/);

  const created = makeResponse();
  await content.createBanner(
    {
      body: { title: "Summer sale", status: "active", sort_order: "2" },
      file: { filename: "summer.png" },
    },
    created,
  );
  assert.equal(created.statusCode, 201);
  assert.equal(calls[1].params[1], "/uploads/banners/summer.png");
});

test("public banners exclude inactive and out-of-date campaigns", async () => {
  calls.length = 0;
  const res = makeResponse();
  await content.getActiveBanners({}, res);
  assert.equal(res.statusCode, 200);
  assert.match(calls[0].sql, /status = 'active'/);
  assert.match(calls[0].sql, /start_date IS NULL OR start_date <= NOW\(\)/);
  assert.match(calls[0].sql, /end_date IS NULL OR end_date >= NOW\(\)/);
});

test("banner update rejects a date range that conflicts with stored dates", async () => {
  calls.length = 0;
  const res = makeResponse();
  await content.updateBanner(
    { params: { id: "1" }, body: { start_date: "2030-01-01T00:00:00Z" } },
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /end_date cannot be earlier/);
});

test("settings can be created, listed, and are validated", async () => {
  calls.length = 0;
  const created = makeResponse();
  await content.createSetting(
    {
      body: {
        key: "store_name",
        value: "ShopSphere",
        type: "string",
        description: "Displayed store name",
      },
    },
    created,
  );
  assert.equal(created.statusCode, 201);
  assert.match(calls[0].sql, /INSERT INTO settings/);

  const invalid = makeResponse();
  await content.createSetting(
    { body: { key: "bad", value: { secret: true } } },
    invalid,
  );
  assert.equal(invalid.statusCode, 400);
});

test("admin activity logs return pagination and support parameterized filters", async () => {
  calls.length = 0;
  const res = makeResponse();
  await audit.getAdminActivityLogs(
    {
      query: {
        admin_id: "3",
        entity_type: "settings",
        page: "1",
        limit: "10",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.pagination.total, 1);
  assert.deepEqual(calls[0].params, ["3", "%settings%", 10, 0]);

  const invalid = makeResponse();
  await audit.getAdminActivityLogs({ query: { admin_id: "0" } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("roles and assigned user roles are read-only views", async () => {
  calls.length = 0;
  const allRoles = makeResponse();
  await roles.getRoles({}, allRoles);
  assert.equal(allRoles.statusCode, 200);
  assert.equal(allRoles.body.roles[0].assigned_users, 1);

  const userRoles = makeResponse();
  await roles.getUserRoles({ params: { id: "3" } }, userRoles);
  assert.equal(userRoles.statusCode, 200);
  assert.equal(userRoles.body.roles[0].name, "admin");

  const routeSource = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../routes/adminRoutes.js"),
    "utf8",
  );
  assert.match(routeSource, /router\.get\("\/roles", authMiddleware, adminMiddleware, getRoles\)/);
  assert.doesNotMatch(routeSource, /router\.(post|put|patch|delete)\("\/roles/);
  assert.match(
    routeSource,
    /router\.get\(\s*"\/activity-logs",\s*authMiddleware,\s*adminMiddleware,\s*getAdminActivityLogs/s,
  );
  assert.match(
    routeSource,
    /router\.post\(\s*"\/banners",\s*authMiddleware,\s*adminMiddleware,\s*uploadBanner\.single\("image"\),\s*createBanner/s,
  );
});
