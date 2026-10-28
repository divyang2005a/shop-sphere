const db = require("../config/db");
const {
  normalizePincode,
  parsePincodes,
} = require("../services/shippingService");

const isValidId = (value) =>
  /^[1-9]\d*$/.test(String(value ?? "")) &&
  Number.isSafeInteger(Number(value));

const normalizeStatus = (value, defaultStatus = "active") => {
  if (value === undefined) {
    return defaultStatus;
  }

  if (typeof value !== "string") {
    return null;
  }

  const status = value.trim().toLowerCase();
  return ["active", "inactive"].includes(status) ? status : null;
};

const parseMoney = (value) => {
  if (
    typeof value === "boolean" ||
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  if (
    typeof value !== "number" &&
    (typeof value !== "string" ||
      !/^\d+(?:\.\d{1,2})?$/.test(value.trim()))
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) &&
    number >= 0 &&
    number <= 9999999999.99 &&
    Math.abs(number * 100 - Math.round(number * 100)) < 1e-8
    ? number
    : null;
};

const getBodyValue = (body, canonicalName, frontendName) =>
  Object.hasOwn(body, canonicalName)
    ? body[canonicalName]
    : body[frontendName];

const normalizePincodes = (value) => {
  const rawPincodes = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : null;

  if (!rawPincodes || rawPincodes.length === 0) {
    return null;
  }

  const pincodes = [...new Set(rawPincodes.map(normalizePincode))];

  if (
    pincodes.some(
      (pincode) =>
        !pincode ||
        pincode.length > 20 ||
        !/^[A-Z0-9][A-Z0-9 -]*$/.test(pincode),
    )
  ) {
    return null;
  }

  return pincodes;
};

const handleDatabaseError = (error, res, message) => {
  console.error(`${message}:`, error);
  return res.status(500).json({ success: false, message });
};

const shapeShippingMethod = (method) => ({
  ...method,
  type: method.description,
  charge: method.price,
  deliveryTime: method.estimated_days,
});

const listShippingMethods = (includeInactive, res) => {
  db.query(
    `SELECT id, name, description, price, estimated_days, status
     FROM shipping_methods
     ${includeInactive ? "" : "WHERE status = 'active'"}
     ORDER BY id ASC`,
    (error, methods) => {
      if (error) {
        return handleDatabaseError(
          error,
          res,
          "Failed to fetch shipping methods",
        );
      }

      const data = methods.map(shapeShippingMethod);
      return res.status(200).json({
        success: true,
        message: "Shipping methods fetched successfully",
        count: data.length,
        data: { shipping_methods: data },
        shipping_methods: data,
      });
    },
  );
};

const getShippingMethods = (req, res) =>
  listShippingMethods(true, res);

const getActiveShippingMethods = (req, res) =>
  listShippingMethods(false, res);

const createShippingMethod = (req, res) => {
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const descriptionValue = getBodyValue(body, "description", "type");
  const priceValue = getBodyValue(body, "price", "charge");
  const estimatedDaysValue = getBodyValue(
    body,
    "estimated_days",
    "deliveryTime",
  );
  const description =
    descriptionValue == null
      ? null
      : typeof descriptionValue === "string"
        ? descriptionValue.trim() || null
        : undefined;
  const price = parseMoney(priceValue);
  const estimatedDays =
    estimatedDaysValue == null
      ? null
      : typeof estimatedDaysValue === "string"
        ? estimatedDaysValue.trim() || null
        : undefined;
  const status = normalizeStatus(body.status);

  if (!name || name.length > 150) {
    return res.status(400).json({
      success: false,
      message: "Shipping method name is required and must be at most 150 characters",
    });
  }

  if (
    price === null ||
    description === undefined ||
    estimatedDays === undefined ||
    (estimatedDays && estimatedDays.length > 50) ||
    !status
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid price, description, delivery estimate, and status",
    });
  }

  db.query(
    `INSERT INTO shipping_methods
       (name, description, price, estimated_days, status)
     VALUES (?, ?, ?, ?, ?)`,
    [name, description, price, estimatedDays, status],
    (error, result) => {
      if (error) {
        return handleDatabaseError(
          error,
          res,
          "Failed to create shipping method",
        );
      }

      const shippingMethod = shapeShippingMethod({
        id: result.insertId,
        name,
        description,
        price,
        estimated_days: estimatedDays,
        status,
      });

      return res.status(201).json({
        success: true,
        message: "Shipping method created successfully",
        data: { shipping_method: shippingMethod },
        shipping_method: shippingMethod,
      });
    },
  );
};

const updateShippingMethod = (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid shipping method ID is required",
    });
  }

  const body = req.body ?? {};
  const fields = [];
  const values = [];
  const updates = [
    {
      input: "name",
      column: "name",
      present: Object.hasOwn(body, "name"),
      value: body.name,
      parse: (value) =>
        typeof value === "string" &&
        value.trim() &&
        value.trim().length <= 150
          ? value.trim()
          : undefined,
    },
    {
      input: "description",
      column: "description",
      present:
        Object.hasOwn(body, "description") || Object.hasOwn(body, "type"),
      value: getBodyValue(body, "description", "type"),
      parse: (value) =>
        value == null
          ? null
          : typeof value === "string"
            ? value.trim() || null
            : undefined,
    },
    {
      input: "price",
      column: "price",
      present: Object.hasOwn(body, "price") || Object.hasOwn(body, "charge"),
      value: getBodyValue(body, "price", "charge"),
      parse: parseMoney,
    },
    {
      input: "estimated_days",
      column: "estimated_days",
      present:
        Object.hasOwn(body, "estimated_days") ||
        Object.hasOwn(body, "deliveryTime"),
      value: getBodyValue(body, "estimated_days", "deliveryTime"),
      parse: (value) =>
        value == null
          ? null
          : typeof value === "string" && value.trim().length <= 50
            ? value.trim() || null
            : undefined,
    },
    {
      input: "status",
      column: "status",
      present: Object.hasOwn(body, "status"),
      value: body.status,
      parse: (value) => normalizeStatus(value, null),
    },
  ];

  for (const update of updates) {
    if (!update.present) {
      continue;
    }

    const value = update.parse(update.value);
    if (value === undefined || (update.input === "price" && value === null)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${update.input}`,
      });
    }

    fields.push(`${update.column} = ?`);
    values.push(value);
  }

  if (!fields.length) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one field to update",
    });
  }

  values.push(id);
  db.query(
    `UPDATE shipping_methods SET ${fields.join(", ")} WHERE id = ?`,
    values,
    (error, result) => {
      if (error) {
        return handleDatabaseError(
          error,
          res,
          "Failed to update shipping method",
        );
      }

      if (result.affectedRows === 0) {
        return db.query(
          "SELECT id FROM shipping_methods WHERE id = ?",
          [id],
          (lookupError, rows) => {
            if (lookupError) {
              return handleDatabaseError(
                lookupError,
                res,
                "Failed to update shipping method",
              );
            }
            if (!rows.length) {
              return res.status(404).json({
                success: false,
                message: "Shipping method not found",
              });
            }
            return res.status(200).json({
              success: true,
              message: "Shipping method updated successfully",
              data: { id: Number(id) },
            });
          },
        );
      }

      return res.status(200).json({
        success: true,
        message: "Shipping method updated successfully",
        data: { id: Number(id) },
      });
    },
  );
};

const shapeZone = (zone) => ({
  ...zone,
  pincodes: parsePincodes(zone.pincodes).map(normalizePincode),
  pincode: parsePincodes(zone.pincodes)
    .map(normalizePincode)
    .join(", "),
  charge: zone.shipping_fee,
});

const listDeliveryAreas = async (includeInactive, req, res) => {
  const pincode = req.query.pincode;

  if (
    pincode !== undefined &&
    (typeof pincode !== "string" || !normalizePincode(pincode))
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid pincode is required",
    });
  }

  try {
    const [zones] = await db.promise().query(
      `SELECT id, name, pincodes, shipping_fee,
              free_shipping_threshold, status
       FROM shipping_zones
       ${includeInactive ? "" : "WHERE status = 'active'"}
       ORDER BY id ASC`,
    );
    const shapedZones = zones.map(shapeZone);
    const matchingZones =
      pincode === undefined
        ? shapedZones
        : shapedZones.filter((zone) =>
            zone.pincodes.includes(normalizePincode(pincode)),
          );

    return res.status(200).json({
      success: true,
      message: "Delivery areas fetched successfully",
      count: matchingZones.length,
      data: { delivery_areas: matchingZones },
      delivery_areas: matchingZones,
    });
  } catch (error) {
    console.error("Get delivery areas error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch delivery areas",
    });
  }
};

const getDeliveryAreas = (req, res) => listDeliveryAreas(true, req, res);

const getActiveDeliveryAreas = (req, res) =>
  listDeliveryAreas(false, req, res);

const createDeliveryArea = async (req, res) => {
  const body = req.body ?? {};
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : [city, state].filter(Boolean).join(", ");
  const pincodes = normalizePincodes(
    getBodyValue(body, "pincodes", "pincode"),
  );
  const shippingFee = parseMoney(
    getBodyValue(body, "shipping_fee", "charge"),
  );
  const freeShippingThreshold =
    body.free_shipping_threshold === undefined ||
    body.free_shipping_threshold === null ||
    body.free_shipping_threshold === ""
      ? null
      : parseMoney(body.free_shipping_threshold);
  const status = normalizeStatus(body.status);

  if (
    Object.hasOwn(body, "estimatedDays") ||
    Object.hasOwn(body, "estimated_days")
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Delivery areas do not store estimated days; configure estimated_days on a shipping method",
    });
  }

  if (
    (Object.hasOwn(body, "city") &&
      (typeof body.city !== "string" || body.city.length > 100)) ||
    (Object.hasOwn(body, "state") &&
      (typeof body.state !== "string" || body.state.length > 100))
  ) {
    return res.status(400).json({
      success: false,
      message: "City and state must be strings of at most 100 characters",
    });
  }

  if (!name || name.length > 150 || !pincodes) {
    return res.status(400).json({
      success: false,
      message: "Name and valid pincodes are required",
    });
  }

  if (
    shippingFee === null ||
    (body.free_shipping_threshold != null &&
      body.free_shipping_threshold !== "" &&
      freeShippingThreshold === null) ||
    !status
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid shipping fee, free-shipping threshold, and status",
    });
  }

  try {
    const [existingZones] = await db.promise().query(
      "SELECT id, name, pincodes FROM shipping_zones WHERE status = 'active'",
    );
    const existingPincodes = new Set(
      existingZones.flatMap((zone) =>
        parsePincodes(zone.pincodes).map(normalizePincode),
      ),
    );
    const overlap = pincodes.find((pincode) => existingPincodes.has(pincode));
    if (status === "active" && overlap) {
      return res.status(409).json({
        success: false,
        message: `Pincode ${overlap} is already assigned to an active delivery area`,
      });
    }

    const [result] = await db.promise().query(
      `INSERT INTO shipping_zones
         (name, pincodes, shipping_fee, free_shipping_threshold, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        JSON.stringify(pincodes),
        shippingFee,
        freeShippingThreshold,
        status,
      ],
    );

    const deliveryArea = shapeZone({
      id: result.insertId,
      name,
      pincodes,
      shipping_fee: shippingFee,
      free_shipping_threshold: freeShippingThreshold,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Delivery area created successfully",
      data: { delivery_area: deliveryArea },
      delivery_area: deliveryArea,
    });
  } catch (error) {
    console.error("Create delivery area error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create delivery area",
    });
  }
};

const updateDeliveryArea = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid delivery area ID is required",
    });
  }

  const body = req.body ?? {};
  const fields = [];
  const values = [];
  let newStatus;
  let newPincodes;

  if (
    Object.hasOwn(body, "estimatedDays") ||
    Object.hasOwn(body, "estimated_days")
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Delivery areas do not store estimated days; configure estimated_days on a shipping method",
    });
  }

  if (
    Object.hasOwn(body, "city") !== Object.hasOwn(body, "state") &&
    !Object.hasOwn(body, "name")
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide both city and state when updating the delivery area name",
    });
  }

  if (
    (Object.hasOwn(body, "city") &&
      (typeof body.city !== "string" || body.city.length > 100)) ||
    (Object.hasOwn(body, "state") &&
      (typeof body.state !== "string" || body.state.length > 100))
  ) {
    return res.status(400).json({
      success: false,
      message: "City and state must be strings of at most 100 characters",
    });
  }

  if (
    Object.hasOwn(body, "name") ||
    (Object.hasOwn(body, "city") && Object.hasOwn(body, "state"))
  ) {
    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : [body.city, body.state]
            .filter((part) => typeof part === "string" && part.trim())
            .map((part) => part.trim())
            .join(", ");
    if (!name || name.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Delivery area name is required and must be at most 150 characters",
      });
    }
    fields.push("name = ?");
    values.push(name);
  }

  if (Object.hasOwn(body, "pincodes") || Object.hasOwn(body, "pincode")) {
    newPincodes = normalizePincodes(
      getBodyValue(body, "pincodes", "pincode"),
    );
    if (!newPincodes) {
      return res.status(400).json({
        success: false,
        message: "Provide valid pincodes",
      });
    }
    fields.push("pincodes = ?");
    values.push(JSON.stringify(newPincodes));
  }

  if (Object.hasOwn(body, "shipping_fee") || Object.hasOwn(body, "charge")) {
    const shippingFee = parseMoney(
      getBodyValue(body, "shipping_fee", "charge"),
    );
    if (shippingFee === null) {
      return res.status(400).json({
        success: false,
        message: "Shipping fee must be a non-negative number",
      });
    }
    fields.push("shipping_fee = ?");
    values.push(shippingFee);
  }

  if (Object.hasOwn(body, "free_shipping_threshold")) {
    const threshold =
      body.free_shipping_threshold === null ||
      body.free_shipping_threshold === ""
        ? null
        : parseMoney(body.free_shipping_threshold);
    if (
      body.free_shipping_threshold !== null &&
      body.free_shipping_threshold !== "" &&
      threshold === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Free-shipping threshold must be non-negative or null",
      });
    }
    fields.push("free_shipping_threshold = ?");
    values.push(threshold);
  }

  if (Object.hasOwn(body, "status")) {
    newStatus = normalizeStatus(body.status, null);
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
    }
    fields.push("status = ?");
    values.push(newStatus);
  }

  if (!fields.length) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one field to update",
    });
  }

  try {
    if (newPincodes || newStatus === "active") {
      const [zones] = await db.promise().query(
        "SELECT id, status, pincodes FROM shipping_zones WHERE id = ? LIMIT 1",
        [id],
      );
      if (!zones.length) {
        return res.status(404).json({
          success: false,
          message: "Delivery area not found",
        });
      }

      const effectiveStatus = newStatus || zones[0].status;
      const effectivePincodes =
        newPincodes || parsePincodes(zones[0].pincodes).map(normalizePincode);

      if (effectiveStatus === "active") {
        const [otherZones] = await db.promise().query(
          "SELECT id, pincodes FROM shipping_zones WHERE status = 'active' AND id <> ?",
          [id],
        );
        const occupied = new Set(
          otherZones.flatMap((zone) =>
            parsePincodes(zone.pincodes).map(normalizePincode),
          ),
        );
        const overlap = effectivePincodes.find((pincode) =>
          occupied.has(pincode),
        );
        if (overlap) {
          return res.status(409).json({
            success: false,
            message: `Pincode ${overlap} is already assigned to an active delivery area`,
          });
        }
      }
    }

    values.push(id);
    const [result] = await db.promise().query(
      `UPDATE shipping_zones SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    if (result.affectedRows === 0) {
      const [rows] = await db.promise().query(
        "SELECT id FROM shipping_zones WHERE id = ?",
        [id],
      );
      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: "Delivery area not found",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Delivery area updated successfully",
      data: { id: Number(id) },
    });
  } catch (error) {
    console.error("Update delivery area error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery area",
    });
  }
};

module.exports = {
  createDeliveryArea,
  createShippingMethod,
  getActiveDeliveryAreas,
  getActiveShippingMethods,
  getDeliveryAreas,
  getShippingMethods,
  updateDeliveryArea,
  updateShippingMethod,
};
