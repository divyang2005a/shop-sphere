const db = require("../config/db");

const parseNonNegativeNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
};

const parseLimit = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : null;
};

const parseFirstOrderOnly = (value) => {
  if ([true, 1, "1", "true"].includes(value)) {
    return 1;
  }

  if ([false, 0, "0", "false", undefined, null].includes(value)) {
    return 0;
  }

  return null;
};

// GET ALL COUPONS WITH USAGE COUNTS
const getCoupons = (req, res) => {
  const sql = `
    SELECT
      c.id,
      c.code,
      c.discount_type,
      c.discount_value,
      c.minimum_cart_value,
      c.maximum_discount,
      c.start_date,
      c.end_date,
      c.usage_limit,
      c.user_limit,
      c.per_user_limit,
      c.first_order_only,
      c.status,
      c.created_at,

      COALESCE(u.usage_count, 0) AS usage_count,

      COALESCE(u.user_count, 0) AS user_count,

      CASE
        WHEN c.usage_limit IS NULL THEN NULL
        ELSE GREATEST(
          c.usage_limit - COALESCE(u.usage_count, 0),
          0
        )
      END AS remaining_uses,

      CASE
        WHEN c.usage_limit IS NOT NULL
          AND COALESCE(u.usage_count, 0) >= c.usage_limit
        THEN 1
        ELSE 0
      END AS usage_limit_reached

    FROM coupons c

    LEFT JOIN (
      SELECT
        coupon_id,
        COUNT(*) AS usage_count,
        COUNT(DISTINCT user_id) AS user_count
      FROM coupon_usages
      GROUP BY coupon_id
    ) u ON u.coupon_id = c.id

    ORDER BY c.id DESC
  `;

  db.query(sql, (error, coupons) => {
    if (error) {
      console.error("Coupon fetch error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch coupons",
      });
    }

    return res.status(200).json({
      success: true,
      count: coupons.length,
      coupons,
    });
  });
};

// UPDATE COUPON STATUS
const updateCouponStatus = (req, res) => {
  const couponId = String(req.params.id ?? "");

  const status =
    typeof req.body?.status === "string"
      ? req.body.status.trim().toLowerCase()
      : "";

  if (
    !/^[1-9]\d*$/.test(couponId) ||
    !Number.isSafeInteger(Number(couponId))
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid coupon ID is required",
    });
  }

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be active or inactive",
    });
  }

  db.query(
    "UPDATE coupons SET status = ? WHERE id = ?",
    [status, couponId],
    (updateError, result) => {
      if (updateError) {
        console.error("Coupon status update error:", updateError);

        return res.status(500).json({
          success: false,
          message: "Failed to update coupon status",
        });
      }

      if (result.affectedRows > 0) {
        return res.status(200).json({
          success: true,
          message: "Coupon status updated successfully",
          coupon: {
            id: Number(couponId),
            status,
          },
        });
      }

      db.query(
        "SELECT id FROM coupons WHERE id = ? LIMIT 1",
        [couponId],
        (lookupError, coupons) => {
          if (lookupError) {
            console.error(
              "Coupon status lookup error:",
              lookupError
            );

            return res.status(500).json({
              success: false,
              message: "Failed to update coupon status",
            });
          }

          if (!coupons.length) {
            return res.status(404).json({
              success: false,
              message: "Coupon not found",
            });
          }

          return res.status(200).json({
            success: true,
            message: "Coupon status updated successfully",
            coupon: {
              id: Number(couponId),
              status,
            },
          });
        }
      );
    }
  );
};

// CREATE COUPON
const createCoupon = (req, res) => {
  const body = req.body ?? {};

  const code =
    typeof body.code === "string"
      ? body.code.trim().toUpperCase()
      : "";

  const discountType =
    typeof body.discount_type === "string"
      ? body.discount_type.trim().toLowerCase()
      : "";

  const discountValue = parseNonNegativeNumber(
    body.discount_value
  );

  const minimumCartValue =
    body.minimum_cart_value === undefined
      ? 0
      : parseNonNegativeNumber(body.minimum_cart_value);

  const maximumDiscount =
    body.maximum_discount === undefined
      ? null
      : parseNonNegativeNumber(body.maximum_discount);

  const usageLimit =
    body.usage_limit === undefined
      ? null
      : parseLimit(body.usage_limit);

  const userLimit =
    body.user_limit === undefined
      ? null
      : parseLimit(body.user_limit);

  const perUserLimit =
    body.per_user_limit === undefined
      ? null
      : parseLimit(body.per_user_limit);

  const firstOrderOnly = parseFirstOrderOnly(
    body.first_order_only
  );

  const status =
    body.status === undefined
      ? "active"
      : typeof body.status === "string"
        ? body.status.trim().toLowerCase()
        : "";

  const startDate =
    typeof body.start_date === "string"
      ? new Date(body.start_date)
      : null;

  const endDate =
    typeof body.end_date === "string"
      ? new Date(body.end_date)
      : null;

  // Validate coupon code
  if (!/^[A-Z0-9_-]{1,100}$/.test(code)) {
    return res.status(400).json({
      success: false,
      message:
        "Coupon code must contain only letters, numbers, hyphens, or underscores",
    });
  }

  // Validate discount type and value
  const isPercentage = [
    "percentage",
    "percent",
    "%",
  ].includes(discountType);

  const isFixed = [
    "fixed",
    "flat",
    "amount",
  ].includes(discountType);

  if (
    (!isPercentage && !isFixed) ||
    discountValue === null ||
    discountValue <= 0 ||
    (isPercentage && discountValue > 100)
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid discount type and value",
    });
  }

  // Validate cart values
  if (
    minimumCartValue === null ||
    (
      body.maximum_discount != null &&
      maximumDiscount === null
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Cart value and maximum discount must be non-negative numbers",
    });
  }

  // Validate usage limits
  if (
    (body.usage_limit != null && usageLimit === null) ||
    (body.user_limit != null && userLimit === null) ||
    (body.per_user_limit != null && perUserLimit === null)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Usage and user limits must be non-negative integers",
    });
  }

  // Validate first order option
  if (firstOrderOnly === null) {
    return res.status(400).json({
      success: false,
      message: "first_order_only must be a boolean",
    });
  }

  // Validate status
  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be active or inactive",
    });
  }

  // Validate dates
  if (
    !startDate ||
    !endDate ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate >= endDate
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide valid start_date and end_date, with end_date after start_date",
    });
  }

  // A zero total-use limit means the coupon cannot be used.
  // A zero per-user limit means no user can redeem it.
  const effectiveStatus =
    usageLimit === 0 ||
    perUserLimit === 0 ||
    userLimit === 0
      ? "inactive"
      : status;

  // Check for duplicate coupon code
  db.query(
    "SELECT id FROM coupons WHERE UPPER(code) = ? LIMIT 1",
    [code],
    (lookupError, existingCoupons) => {
      if (lookupError) {
        console.error(
          "Coupon duplicate check error:",
          lookupError
        );

        return res.status(500).json({
          success: false,
          message: "Failed to create coupon",
        });
      }

      if (existingCoupons.length) {
        return res.status(409).json({
          success: false,
          message: "A coupon with this code already exists",
        });
      }

      const sql = `
        INSERT INTO coupons
        (
          code,
          discount_type,
          discount_value,
          minimum_cart_value,
          maximum_discount,
          start_date,
          end_date,
          usage_limit,
          user_limit,
          per_user_limit,
          first_order_only,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          code,
          isPercentage ? "percentage" : "fixed",
          discountValue,
          minimumCartValue,
          maximumDiscount,
          startDate,
          endDate,
          usageLimit,
          userLimit,
          perUserLimit,
          firstOrderOnly,
          effectiveStatus,
        ],
        (insertError, result) => {
          if (insertError) {
            if (insertError.code === "ER_DUP_ENTRY") {
              return res.status(409).json({
                success: false,
                message:
                  "A coupon with this code already exists",
              });
            }

            console.error(
              "Coupon creation error:",
              insertError
            );

            return res.status(500).json({
              success: false,
              message: "Failed to create coupon",
            });
          }

          return res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            coupon: {
              id: result.insertId,
              code,
              discount_type: isPercentage
                ? "percentage"
                : "fixed",
              discount_value: discountValue,
              minimum_cart_value: minimumCartValue,
              maximum_discount: maximumDiscount,
              start_date: startDate,
              end_date: endDate,
              usage_limit: usageLimit,
              user_limit: userLimit,
              per_user_limit: perUserLimit,
              first_order_only: firstOrderOnly,
              status: effectiveStatus,
              usage_count: 0,
              user_count: 0,
              remaining_uses: usageLimit,
              usage_limit_reached: usageLimit === 0 ? 1 : 0,
            },
          });
        }
      );
    }
  );
};

module.exports = {
  createCoupon,
  getCoupons,
  updateCouponStatus,
};