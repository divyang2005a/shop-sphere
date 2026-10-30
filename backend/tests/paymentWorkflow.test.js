const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

let scenario;
let notificationCalls = 0;

const connection = {
  async beginTransaction() {
    scenario.beginCount += 1;
  },
  async commit() {
    scenario.commitCount += 1;
  },
  async rollback() {
    scenario.rollbackCount += 1;
  },
  release() {
    scenario.releaseCount += 1;
  },
  async query(sql, params = []) {
    if (sql.includes("FROM orders") && sql.includes("FOR UPDATE")) {
      return [scenario.order ? [scenario.order] : []];
    }

    if (sql.includes("FROM payment_methods")) {
      const methodValue = String(params[0] ?? "").toLowerCase();
      const matches = scenario.paymentMethods.filter(
        (method) =>
          method.code.toLowerCase() === methodValue ||
          method.name.toLowerCase() === methodValue,
      );
      return [matches.slice(0, 1)];
    }

    if (sql.includes("FROM payments") && sql.includes("FOR UPDATE")) {
      return [scenario.payments];
    }

    if (sql.includes("FROM notifications")) {
      return [[]];
    }

    if (sql.includes("UPDATE payments")) {
      const payment = scenario.payments.find(
        (record) => record.id === params[0],
      );
      if (!payment || payment.status !== "pending") {
        return [{ affectedRows: 0 }];
      }
      payment.status = "paid";
      payment.paid_at = "2026-10-30 12:00:00";
      return [{ affectedRows: 1 }];
    }

    if (sql.includes("UPDATE orders")) {
      if (
        scenario.order.payment_status !== "pending" ||
        scenario.order.order_status === "cancelled"
      ) {
        return [{ affectedRows: 0 }];
      }
      scenario.order.payment_status = "paid";
      return [{ affectedRows: 1 }];
    }

    if (sql.includes("INSERT INTO payments")) {
      scenario.payments.push({
        id: 2,
        user_id: params[1],
        payment_method: params[2],
        amount: params[3],
        status: "paid",
        paid_at: "2026-10-30 12:00:00",
      });
      return [{ affectedRows: 1, insertId: 2 }];
    }

    if (sql.includes("INSERT INTO admin_audit_logs")) {
      return [{ affectedRows: 1 }];
    }

    throw new Error(`Unexpected SQL in payment workflow test: ${sql}`);
  },
};

const dbPath = require.resolve("../config/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    promise: () => ({
      getConnection: async () => connection,
    }),
  },
};

const notificationPath = require.resolve("../services/notificationService");
require.cache[notificationPath] = {
  id: notificationPath,
  filename: notificationPath,
  loaded: true,
  exports: {
    createNotification: async () => {
      notificationCalls += 1;
    },
  },
};

const { confirmOrderPayment } = require("../controllers/adminOrderController");
const rejectPaymentCredentials = require("../middleware/rejectPaymentCredentials");

const makeScenario = (overrides = {}) => {
  scenario = {
    order: {
      id: 12,
      user_id: 7,
      order_number: "SS-12",
      order_status: "processing",
      payment_status: "pending",
      payment_method: "UPI",
      total_amount: "125.50",
      ...overrides.order,
    },
    payments: [
      {
        id: 1,
        user_id: 7,
        payment_method: "UPI",
        amount: "125.50",
        status: "pending",
        ...overrides.payment,
      },
    ],
    paymentMethods: [
      { code: "cod", name: "Cash on Delivery" },
      { code: "upi", name: "UPI" },
      { code: "card", name: "Card" },
    ],
    beginCount: 0,
    commitCount: 0,
    rollbackCount: 0,
    releaseCount: 0,
  };
};

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

const confirm = async ({
  orderId = "12",
  adminId = 3,
  body,
} = {}) => {
  const res = makeResponse();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await confirmOrderPayment(
      {
        params: { order_id: orderId },
        user: adminId === null ? {} : { user_id: adminId },
        body,
        ip: "127.0.0.1",
      },
      res,
    );
  } finally {
    console.error = originalConsoleError;
  }
  return res;
};

test("UPI and Card checkout orders remain pending with pending payment rows", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../controllers/orderController.js"),
    "utf8",
  );
  assert.match(source, /WHERE id = \? AND status = 'active'/);
  assert.match(source, /payment_status,\s*order_status,[\s\S]*?'pending', 'pending'/);
  assert.match(source, /VALUES \(\?, \?, \?, \?, 'pending', NOW\(\), NOW\(\)\)/);
  assert.match(source, /SELECT id, code, name, description[\s\S]*FROM payment_methods[\s\S]*WHERE status = 'active'/);

  const res = makeResponse();
  let nextCalled = false;
  rejectPaymentCredentials(
    { body: { card: { number: "4111111111111111" } } },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(res.statusCode, 400);
  assert.equal(nextCalled, false);
});

test("payment confirmation route requires authentication and admin authorization", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../routes/adminRoutes.js"),
    "utf8",
  );
  assert.match(
    source,
    /router\.patch\(\s*"\/orders\/:order_id\/payment-status",\s*authMiddleware,\s*adminMiddleware,\s*confirmOrderPayment/s,
  );
});

test("unauthorized administrators cannot confirm a payment", async () => {
  makeScenario();
  const res = await confirm({ adminId: null });
  assert.equal(res.statusCode, 401);
  assert.equal(scenario.beginCount, 0);
});

test("invalid order IDs are rejected before opening a transaction", async () => {
  makeScenario();
  const res = await confirm({ orderId: "0" });
  assert.equal(res.statusCode, 400);
  assert.equal(scenario.beginCount, 0);

  const nonDecimalId = await confirm({ orderId: "1e1" });
  assert.equal(nonDecimalId.statusCode, 400);
  assert.equal(scenario.beginCount, 0);
});

test("cancelled orders cannot have payments confirmed", async () => {
  makeScenario({ order: { order_status: "cancelled" } });
  const res = await confirm();
  assert.equal(res.statusCode, 400);
  assert.equal(scenario.order.payment_status, "pending");
  assert.equal(scenario.rollbackCount, 1);
});

test("duplicate or unsupported payment transitions are rejected", async () => {
  makeScenario({ order: { payment_status: "paid" } });
  const duplicate = await confirm();
  assert.equal(duplicate.statusCode, 409);

  makeScenario({ order: { payment_status: "failed" } });
  const unsupported = await confirm();
  assert.equal(unsupported.statusCode, 409);
  assert.equal(scenario.order.payment_status, "failed");
});

test("unsupported order states and payment methods are rejected", async () => {
  makeScenario({ order: { order_status: "returned" } });
  const invalidOrderState = await confirm();
  assert.equal(invalidOrderState.statusCode, 409);

  makeScenario();
  scenario.paymentMethods = scenario.paymentMethods.filter(
    (method) => method.code !== "upi",
  );
  const unsupportedMethod = await confirm();
  assert.equal(unsupportedMethod.statusCode, 409);
  assert.equal(scenario.order.payment_status, "pending");
});

test("UPI payment confirmation updates payment and order atomically", async () => {
  makeScenario();
  const res = await confirm();
  assert.equal(res.statusCode, 200);
  assert.equal(scenario.order.payment_status, "paid");
  assert.equal(scenario.payments[0].status, "paid");
  assert.ok(scenario.payments[0].paid_at);
  assert.equal(scenario.commitCount, 1);
  assert.equal(scenario.rollbackCount, 0);

  const duplicate = await confirm();
  assert.equal(duplicate.statusCode, 409);
  assert.equal(scenario.commitCount, 1);
});

test("Card payment can be manually confirmed after receipt verification", async () => {
  makeScenario({
    order: { payment_method: "Card" },
    payment: { payment_method: "Card" },
  });
  const res = await confirm();
  assert.equal(res.statusCode, 200);
  assert.equal(scenario.order.payment_status, "paid");
  assert.equal(scenario.payments[0].status, "paid");
});

test("COD keeps shipment cash-receipt flow and disallows early confirmation", async () => {
  const shipmentSource = fs.readFileSync(
    path.join(__dirname, "../controllers/shipmentController.js"),
    "utf8",
  );
  assert.match(
    shipmentSource,
    /normalizedStatus === "delivered" &&\s*isCOD &&\s*cash_received === true/,
  );

  makeScenario({
    order: { payment_method: "Cash on Delivery" },
    payment: { payment_method: "Cash on Delivery" },
  });
  const beforeDelivery = await confirm();
  assert.equal(beforeDelivery.statusCode, 409);
  assert.equal(scenario.order.payment_status, "pending");

  makeScenario({
    order: {
      payment_method: "Cash on Delivery",
      order_status: "delivered",
    },
    payment: { payment_method: "Cash on Delivery" },
  });
  const afterDelivery = await confirm();
  assert.equal(afterDelivery.statusCode, 200);
  assert.equal(scenario.order.payment_status, "paid");
});

test("client payment status, transaction IDs, and credential fields are rejected", async () => {
  makeScenario();
  const statusPayload = await confirm({
    body: { payment_status: "paid", transaction_id: "fake" },
  });
  assert.equal(statusPayload.statusCode, 400);
  assert.equal(scenario.beginCount, 0);
});
