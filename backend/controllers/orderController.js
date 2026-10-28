const db = require("../config/db");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");
const { createNotification } = require("../services/notificationService");
const { getActiveDeliveryZone } = require("../services/shippingService");

const checkoutSummary = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const shipping_method_id =
      req.query.shipping_method_id ?? req.body?.shipping_method_id;

    const requestedShippingAddressId =
      req.query.shipping_address_id ?? req.body?.shipping_address_id;

    const coupon_code = req.query.coupon_code ?? req.body?.coupon_code;

    const [carts] = await db.promise().query(
      `SELECT id
       FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY id DESC
       LIMIT 1`,
      [userId],
    );

    if (!carts.length) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    const [items] = await db.promise().query(
      `SELECT
         ci.product_id,
         ci.variant_id,
         ci.quantity,
         p.title,
         p.base_price,
         p.sale_price,
         p.tax_percentage,
         p.stock_quantity AS product_stock,
         p.status AS product_status,
         pv.price AS variant_price,
         pv.stock_quantity AS variant_stock,
         pv.status AS variant_status
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants pv
         ON pv.id = ci.variant_id
        AND pv.product_id = ci.product_id
       WHERE ci.cart_id = ?`,
      [carts[0].id],
    );

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    let subtotal = 0;
    let totalTax = 0;
    const summaryItems = [];

    for (const item of items) {
      if (String(item.product_status).toLowerCase() !== "active") {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product_id} is not available`,
        });
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Cart contains an invalid quantity",
        });
      }

      let price = Number(item.sale_price ?? item.base_price);
      let stock = Number(item.product_stock);

      if (item.variant_id !== null) {
        if (String(item.variant_status).toLowerCase() !== "active") {
          return res.status(400).json({
            success: false,
            message: `Variant for product ${item.product_id} is unavailable`,
          });
        }

        stock = Number(item.variant_stock);

        if (item.variant_price !== null) {
          price = Number(item.variant_price);
        }
      }

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for product ${item.product_id}`,
        });
      }

      if (!Number.isFinite(stock) || quantity > stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${item.product_id}`,
        });
      }

      const lineSubtotal = Number((price * quantity).toFixed(2));
      const taxRate = Number(item.tax_percentage || 0);

      if (!Number.isFinite(taxRate) || taxRate < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid tax rate for product ${item.product_id}`,
        });
      }

      const itemTax = Number(((lineSubtotal * taxRate) / 100).toFixed(2));

      subtotal += lineSubtotal;
      totalTax += itemTax;

      summaryItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        title: item.title,
        quantity,
        unit_price: price,
        subtotal: lineSubtotal,
        tax: itemTax,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalTax = Number(totalTax.toFixed(2));

    let shippingFee = 0;
    let shippingMethod = null;
    let deliveryZone = null;
    let shippingAddressId = null;

    if (
      shipping_method_id !== undefined &&
      shipping_method_id !== null &&
      shipping_method_id !== ""
    ) {
      const methodId = Number(shipping_method_id);

      if (
        !/^[1-9]\d*$/.test(String(shipping_method_id)) ||
        !Number.isSafeInteger(methodId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid shipping method ID",
        });
      }

      const [methods] = await db.promise().query(
        `SELECT id, name, price, estimated_days
         FROM shipping_methods
         WHERE id = ? AND status = 'active'
         LIMIT 1`,
        [methodId],
      );

      if (!methods.length) {
        return res.status(400).json({
          success: false,
          message: "Active shipping method not found",
        });
      }

      shippingMethod = methods[0];

      if (
        requestedShippingAddressId === undefined ||
        requestedShippingAddressId === null ||
        requestedShippingAddressId === ""
      ) {
        const [defaultAddresses] = await db.promise().query(
          `SELECT id, pincode
           FROM addresses
           WHERE user_id = ?
           ORDER BY is_default DESC, id DESC
           LIMIT 1`,
          [userId],
        );

        if (!defaultAddresses.length) {
          return res.status(400).json({
            success: false,
            message:
              "Please add a delivery address before selecting a shipping method",
          });
        }

        shippingAddressId = Number(defaultAddresses[0].id);
      } else {
        if (
          !/^[1-9]\d*$/.test(String(requestedShippingAddressId)) ||
          !Number.isSafeInteger(Number(requestedShippingAddressId))
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid shipping_address_id",
          });
        }

        shippingAddressId = Number(requestedShippingAddressId);
      }

      const [addresses] = await db.promise().query(
        `SELECT id, pincode
         FROM addresses
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [shippingAddressId, userId],
      );

      if (!addresses.length) {
        return res.status(404).json({
          success: false,
          message: "Shipping address not found",
        });
      }

      deliveryZone = await getActiveDeliveryZone(
        db.promise(),
        addresses[0].pincode,
      );

      if (!deliveryZone) {
        return res.status(400).json({
          success: false,
          message: "Delivery is not available at this pincode",
        });
      }

      const freeThreshold = deliveryZone.free_shipping_threshold;

      shippingFee =
        freeThreshold !== null && subtotal >= Number(freeThreshold)
          ? 0
          : Number(deliveryZone.shipping_fee);

      if (!Number.isFinite(shippingFee) || shippingFee < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid shipping fee",
        });
      }
    }

    let couponDiscount = 0;
    let appliedCouponCode = null;

    if (
      coupon_code !== undefined &&
      coupon_code !== null &&
      coupon_code !== ""
    ) {
      if (typeof coupon_code !== "string" || !coupon_code.trim()) {
        return res.status(400).json({
          success: false,
          message: "Invalid coupon code",
        });
      }

      const [coupons] = await db.promise().query(
        `SELECT
           id,
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
         FROM coupons
         WHERE UPPER(code) = ?
         LIMIT 1`,
        [coupon_code.trim().toUpperCase()],
      );

      if (!coupons.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid coupon code",
        });
      }

      const coupon = coupons[0];
      const now = Date.now();

      if (
        String(coupon.status).toLowerCase() !== "active" ||
        !coupon.start_date ||
        !coupon.end_date ||
        now < new Date(coupon.start_date).getTime() ||
        now > new Date(coupon.end_date).getTime()
      ) {
        return res.status(400).json({
          success: false,
          message: "This coupon is not currently valid",
        });
      }

      if (subtotal < Number(coupon.minimum_cart_value || 0)) {
        return res.status(400).json({
          success: false,
          message: `Minimum cart value for this coupon is ${Number(
            coupon.minimum_cart_value || 0,
          ).toFixed(2)}`,
        });
      }

      if (coupon.usage_limit !== null) {
        const [usage] = await db.promise().query(
          `SELECT COUNT(*) AS total_uses
           FROM coupon_usages
           WHERE coupon_id = ?`,
          [coupon.id],
        );

        if (Number(usage[0].total_uses) >= Number(coupon.usage_limit)) {
          return res.status(400).json({
            success: false,
            message: "This coupon usage limit has been reached",
          });
        }
      }

      if (coupon.user_limit !== null) {
        const [userCounts] = await db.promise().query(
          `SELECT COUNT(DISTINCT user_id) AS total_users
           FROM coupon_usages
           WHERE coupon_id = ?`,
          [coupon.id],
        );

        if (Number(userCounts[0].total_users) >= Number(coupon.user_limit)) {
          return res.status(400).json({
            success: false,
            message: "This coupon user limit has been reached",
          });
        }
      }

      if (coupon.per_user_limit !== null) {
        const [usage] = await db.promise().query(
          `SELECT COUNT(*) AS total_uses
           FROM coupon_usages
           WHERE coupon_id = ? AND user_id = ?`,
          [coupon.id, userId],
        );

        if (Number(usage[0].total_uses) >= Number(coupon.per_user_limit)) {
          return res.status(400).json({
            success: false,
            message:
              "You have already used this coupon the maximum number of times",
          });
        }
      }

      if (Number(coupon.first_order_only) === 1) {
        const [orders] = await db.promise().query(
          `SELECT COUNT(*) AS total_orders
           FROM orders
           WHERE user_id = ?
             AND order_status <> 'cancelled'`,
          [userId],
        );

        if (Number(orders[0].total_orders) > 0) {
          return res.status(400).json({
            success: false,
            message: "This coupon is available only on your first order",
          });
        }
      }

      const type = String(coupon.discount_type).trim().toLowerCase();
      const value = Number(coupon.discount_value);

      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({
          success: false,
          message: "Coupon has an invalid discount value",
        });
      }

      if (["percentage", "percent", "%"].includes(type)) {
        couponDiscount = (subtotal * value) / 100;
      } else if (["fixed", "flat", "amount"].includes(type)) {
        couponDiscount = value;
      } else {
        return res.status(400).json({
          success: false,
          message: `Unsupported coupon discount type: ${coupon.discount_type}`,
        });
      }

      if (coupon.maximum_discount !== null) {
        const maximum = Number(coupon.maximum_discount);

        if (Number.isFinite(maximum) && maximum >= 0) {
          couponDiscount = Math.min(couponDiscount, maximum);
        }
      }

      couponDiscount = Number(
        Math.min(subtotal, Math.max(0, couponDiscount)).toFixed(2),
      );

      appliedCouponCode = coupon.code;
    }

    const totalAmount = Number(
      Math.max(0, subtotal + totalTax + shippingFee - couponDiscount).toFixed(
        2,
      ),
    );

    const [shippingMethods] = await db.promise().query(
      `SELECT id, name, description, price, estimated_days
       FROM shipping_methods
       WHERE status = 'active'
       ORDER BY price ASC`,
    );

    const [paymentMethods] = await db.promise().query(
      `SELECT id, code, name, description
       FROM payment_methods
       WHERE status = 'active'
       ORDER BY sort_order ASC, id ASC`,
    );

    return res.status(200).json({
      success: true,
      data: {
        items: summaryItems,
        subtotal,
        tax: totalTax,
        shipping_address_id: shippingAddressId,
        shipping_method: shippingMethod,
        delivery_area: deliveryZone,
        shipping_fee: shippingFee,
        coupon_code: appliedCouponCode,
        coupon_discount: couponDiscount,
        total: totalAmount,
        available_shipping_methods: shippingMethods,
        available_payment_methods: paymentMethods,
      },
    });
  } catch (error) {
    console.error("Checkout summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to calculate checkout summary",
    });
  }
};

const createOrder = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const userId = req.user.user_id;

    const {
      billing_address_id,
      shipping_address_id,
      shipping_method_id,
      payment_method_id,
      coupon_code,
      buy_now,
      product_id,
      quantity: buyNowQuantity,
      variant_id,
    } = req.body;

    const isBuyNow =
      buy_now === true ||
      buy_now === "true" ||
      buy_now === 1 ||
      buy_now === "1";

    if (
      !Number.isInteger(Number(billing_address_id)) ||
      Number(billing_address_id) <= 0 ||
      !Number.isInteger(Number(shipping_address_id)) ||
      Number(shipping_address_id) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid billing and shipping address IDs are required",
      });
    }

    if (
      !/^[1-9]\d*$/.test(String(shipping_method_id ?? "")) ||
      !Number.isSafeInteger(Number(shipping_method_id))
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid shipping_method_id is required",
      });
    }

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    let paymentMethodName = null;
    let deliveryZone = null;

    if (
      payment_method_id !== undefined &&
      payment_method_id !== null &&
      payment_method_id !== ""
    ) {
      const methodId = Number(payment_method_id);

      if (
        !/^[1-9]\d*$/.test(String(payment_method_id)) ||
        !Number.isSafeInteger(methodId)
      ) {
        throw new Error("Invalid payment method ID");
      }

      const [paymentMethods] = await connection.query(
        `SELECT id, name
         FROM payment_methods
         WHERE id = ? AND status = 'active'
         LIMIT 1
         FOR UPDATE`,
        [methodId],
      );

      if (!paymentMethods.length) {
        throw new Error("Selected payment method is not available");
      }

      paymentMethodName = paymentMethods[0].name;
    }

    const [addresses] = await connection.query(
      `SELECT id, pincode
       FROM addresses
       WHERE user_id = ? AND id IN (?, ?)
       FOR UPDATE`,
      [userId, Number(billing_address_id), Number(shipping_address_id)],
    );

    const addressIds = new Set(addresses.map((address) => String(address.id)));

    if (
      !addressIds.has(String(Number(billing_address_id))) ||
      !addressIds.has(String(Number(shipping_address_id)))
    ) {
      throw new Error("Invalid billing or shipping address");
    }

    const shippingAddress = addresses.find(
      (address) => String(address.id) === String(Number(shipping_address_id)),
    );

    let cartId = null;
    let cartItems = [];

    if (isBuyNow) {
      const selectedProductId = Number(product_id);
      const selectedQuantity = Number(buyNowQuantity);

      if (!Number.isInteger(selectedProductId) || selectedProductId <= 0) {
        throw new Error("A valid product_id is required for Buy Now");
      }

      if (!Number.isInteger(selectedQuantity) || selectedQuantity <= 0) {
        throw new Error("Buy Now quantity must be a positive integer");
      }

      let selectedVariantId = null;

      if (
        variant_id !== undefined &&
        variant_id !== null &&
        variant_id !== ""
      ) {
        selectedVariantId = Number(variant_id);

        if (!Number.isInteger(selectedVariantId) || selectedVariantId <= 0) {
          throw new Error("Invalid variant_id for Buy Now");
        }
      }

      const [products] = await connection.query(
        `SELECT id, title, sku, base_price, sale_price,
                tax_percentage, stock_quantity, status
         FROM products
         WHERE id = ?
         FOR UPDATE`,
        [selectedProductId],
      );

      if (products.length === 0) {
        throw new Error("Selected product was not found");
      }

      const product = products[0];

      if (String(product.status).toLowerCase() !== "active") {
        throw new Error("Selected product is not available");
      }

      let variantSku = null;
      let variantPrice = null;
      let variantStock = null;
      let variantStatus = null;

      if (selectedVariantId !== null) {
        const [variants] = await connection.query(
          `SELECT id, sku, price, stock_quantity, status
           FROM product_variants
           WHERE id = ? AND product_id = ?
           FOR UPDATE`,
          [selectedVariantId, selectedProductId],
        );

        if (variants.length === 0) {
          throw new Error("Selected product variant was not found");
        }

        const variant = variants[0];

        if (String(variant.status).toLowerCase() !== "active") {
          throw new Error("Selected product variant is not available");
        }

        variantSku = variant.sku;
        variantPrice = variant.price;
        variantStock = variant.stock_quantity;
        variantStatus = variant.status;

        if (
          !Number.isFinite(Number(variantStock)) ||
          selectedQuantity > Number(variantStock)
        ) {
          throw new Error(
            `Insufficient stock for selected product variant. Available stock: ${
              Number(variantStock) || 0
            }`,
          );
        }
      } else if (
        !Number.isFinite(Number(product.stock_quantity)) ||
        selectedQuantity > Number(product.stock_quantity)
      ) {
        throw new Error(
          `Insufficient stock for selected product. Available stock: ${
            Number(product.stock_quantity) || 0
          }`,
        );
      }

      cartItems = [
        {
          id: null,
          product_id: product.id,
          variant_id: selectedVariantId,
          quantity: selectedQuantity,
          title: product.title,
          sku: product.sku,
          base_price: product.base_price,
          sale_price: product.sale_price,
          tax_percentage: product.tax_percentage,
          product_stock: product.stock_quantity,
          product_status: product.status,
          variant_sku: variantSku,
          variant_price: variantPrice,
          variant_stock: variantStock,
          variant_status: variantStatus,
        },
      ];
    } else {
      const [carts] = await connection.query(
        `SELECT id
         FROM carts
         WHERE user_id = ? AND status = 'active'
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [userId],
      );

      if (carts.length === 0) {
        throw new Error("Your cart is empty");
      }

      cartId = carts[0].id;

      const [items] = await connection.query(
        `SELECT ci.id, ci.product_id, ci.variant_id,
                ci.quantity, p.title, p.sku,
                p.base_price, p.sale_price,
                p.tax_percentage,
                p.stock_quantity AS product_stock,
                p.status AS product_status,
                pv.sku AS variant_sku,
                pv.price AS variant_price,
                pv.stock_quantity AS variant_stock,
                pv.status AS variant_status
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         LEFT JOIN product_variants pv
           ON pv.id = ci.variant_id
          AND pv.product_id = ci.product_id
         WHERE ci.cart_id = ?
         FOR UPDATE`,
        [cartId],
      );

      if (items.length === 0) {
        throw new Error("Your cart is empty");
      }

      cartItems = items;
    }

    let subtotal = 0;
    let totalTax = 0;
    const orderItems = [];

    for (const item of cartItems) {
      if (String(item.product_status).toLowerCase() !== "active") {
        throw new Error(`Product ${item.product_id} is not available`);
      }

      const itemQuantity = Number(item.quantity);

      if (!Number.isInteger(itemQuantity) || itemQuantity <= 0) {
        throw new Error("Order contains an invalid quantity");
      }

      let price = Number(item.sale_price ?? item.base_price);
      let availableStock = Number(item.product_stock);
      let sku = item.sku;

      if (item.variant_id !== null) {
        const [variants] = await connection.query(
          `SELECT id, sku, price, stock_quantity, status
           FROM product_variants
           WHERE id = ? AND product_id = ?
           FOR UPDATE`,
          [item.variant_id, item.product_id],
        );

        if (
          variants.length === 0 ||
          String(variants[0].status).toLowerCase() !== "active"
        ) {
          throw new Error(
            `Variant for product ${item.product_id} is unavailable`,
          );
        }

        const variant = variants[0];

        availableStock = Number(variant.stock_quantity);
        sku = variant.sku;

        if (variant.price !== null) {
          price = Number(variant.price);
        }
      } else {
        const [products] = await connection.query(
          `SELECT id, stock_quantity, status
           FROM products
           WHERE id = ?
           FOR UPDATE`,
          [item.product_id],
        );

        if (
          products.length === 0 ||
          String(products[0].status).toLowerCase() !== "active"
        ) {
          throw new Error(`Product ${item.product_id} is not available`);
        }

        availableStock = Number(products[0].stock_quantity);
      }

      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Invalid price for product ${item.product_id}`);
      }

      if (!Number.isFinite(availableStock) || itemQuantity > availableStock) {
        throw new Error(
          `Insufficient stock for product ${item.product_id}. Available stock: ${
            Number.isFinite(availableStock) ? availableStock : 0
          }`,
        );
      }

      const lineSubtotal = Number((price * itemQuantity).toFixed(2));
      const taxRate = Number(item.tax_percentage || 0);

      if (!Number.isFinite(taxRate) || taxRate < 0) {
        throw new Error(`Invalid tax rate for product ${item.product_id}`);
      }

      const lineTax = Number(((lineSubtotal * taxRate) / 100).toFixed(2));

      subtotal += lineSubtotal;
      totalTax += lineTax;

      orderItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        sku,
        product_name: item.title,
        quantity: itemQuantity,
        unit_price: price,
        tax: lineTax,
        total: Number((lineSubtotal + lineTax).toFixed(2)),
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalTax = Number(totalTax.toFixed(2));

    let shippingFee = 0;
    let shippingMethodId = null;
    let shippingZoneId = null;

    if (
      shipping_method_id !== undefined &&
      shipping_method_id !== null &&
      shipping_method_id !== ""
    ) {
      shippingMethodId = Number(shipping_method_id);

      if (!Number.isInteger(shippingMethodId) || shippingMethodId <= 0) {
        throw new Error("Invalid shipping method ID");
      }

      const [methods] = await connection.query(
        `SELECT id, price
         FROM shipping_methods
         WHERE id = ? AND status = 'active'`,
        [shippingMethodId],
      );

      if (methods.length === 0) {
        throw new Error("Active shipping method not found");
      }

      deliveryZone = await getActiveDeliveryZone(
        connection,
        shippingAddress.pincode,
      );

      if (!deliveryZone) {
        throw new Error("Delivery is not available at this pincode");
      }

      shippingZoneId = deliveryZone.id;
      const freeThreshold = deliveryZone.free_shipping_threshold;

      shippingFee =
        freeThreshold !== null && subtotal >= Number(freeThreshold)
          ? 0
          : Number(deliveryZone.shipping_fee);

      if (!Number.isFinite(shippingFee) || shippingFee < 0) {
        throw new Error("Invalid shipping fee");
      }
    }

    let couponId = null;
    let couponUserLimit = null;
    let couponUsageLimit = null;
    let couponDiscount = 0;
    let appliedCouponCode = null;

    if (
      coupon_code !== undefined &&
      coupon_code !== null &&
      coupon_code !== ""
    ) {
      if (typeof coupon_code !== "string" || !coupon_code.trim()) {
        throw new Error("Invalid coupon code");
      }

      const normalizedCouponCode = coupon_code.trim().toUpperCase();

      const [coupons] = await connection.query(
        `SELECT id, code, discount_type, discount_value,
                minimum_cart_value, maximum_discount,
                start_date, end_date, usage_limit,
                user_limit, per_user_limit, first_order_only, status
         FROM coupons
         WHERE UPPER(code) = ?
         LIMIT 1
         FOR UPDATE`,
        [normalizedCouponCode],
      );

      if (coupons.length === 0) {
        throw new Error("Invalid coupon code");
      }

      const coupon = coupons[0];

      couponId = coupon.id;
      couponUserLimit = coupon.user_limit;
      couponUsageLimit = coupon.usage_limit;
      appliedCouponCode = coupon.code;

      if (String(coupon.status).toLowerCase() !== "active") {
        throw new Error("This coupon is inactive");
      }

      const [validDates] = await connection.query(
        `SELECT (NOW() >= ? AND NOW() <= ?) AS is_valid`,
        [coupon.start_date, coupon.end_date],
      );

      if (!Number(validDates[0].is_valid)) {
        throw new Error("This coupon is not currently valid");
      }

      const minimumCartValue = Number(coupon.minimum_cart_value || 0);

      if (subtotal < minimumCartValue) {
        throw new Error(
          `Minimum cart value for this coupon is ${minimumCartValue.toFixed(2)}`,
        );
      }

      if (coupon.usage_limit !== null) {
        const usageLimit = Number(coupon.usage_limit);

        if (!Number.isSafeInteger(usageLimit) || usageLimit < 0) {
          throw new Error("Coupon has an invalid usage limit");
        }

        const [usageCounts] = await connection.query(
          `SELECT COUNT(*) AS total_uses
           FROM coupon_usages
           WHERE coupon_id = ?`,
          [coupon.id],
        );

        if (Number(usageCounts[0].total_uses) >= usageLimit) {
          throw new Error("This coupon usage limit has been reached");
        }
      }

      if (coupon.user_limit !== null) {
        const userLimit = Number(coupon.user_limit);

        if (!Number.isSafeInteger(userLimit) || userLimit < 0) {
          throw new Error("Coupon has an invalid user limit");
        }

        const [userCounts] = await connection.query(
          `SELECT COUNT(DISTINCT user_id) AS total_users
           FROM coupon_usages
           WHERE coupon_id = ?`,
          [coupon.id],
        );

        if (Number(userCounts[0].total_users) >= userLimit) {
          throw new Error("This coupon user limit has been reached");
        }
      }

      if (coupon.per_user_limit !== null) {
        const perUserLimit = Number(coupon.per_user_limit);

        if (!Number.isSafeInteger(perUserLimit) || perUserLimit < 0) {
          throw new Error("Coupon has an invalid per-user limit");
        }

        const [userUsageCounts] = await connection.query(
          `SELECT COUNT(*) AS total_uses
           FROM coupon_usages
           WHERE coupon_id = ? AND user_id = ?`,
          [coupon.id, userId],
        );

        if (Number(userUsageCounts[0].total_uses) >= perUserLimit) {
          throw new Error(
            "You have already used this coupon the maximum number of times",
          );
        }
      }

      if (Number(coupon.first_order_only) === 1) {
        const [previousOrders] = await connection.query(
          `SELECT COUNT(*) AS total_orders
           FROM orders
           WHERE user_id = ?
             AND order_status <> 'cancelled'`,
          [userId],
        );

        if (Number(previousOrders[0].total_orders) > 0) {
          throw new Error("This coupon is available only on your first order");
        }
      }

      const discountType = String(coupon.discount_type).trim().toLowerCase();
      const discountValue = Number(coupon.discount_value);

      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error("Coupon has an invalid discount value");
      }

      if (["percentage", "percent", "%"].includes(discountType)) {
        couponDiscount = (subtotal * discountValue) / 100;
      } else if (["fixed", "flat", "amount"].includes(discountType)) {
        couponDiscount = discountValue;
      } else {
        throw new Error(
          `Unsupported coupon discount type: ${coupon.discount_type}`,
        );
      }

      if (coupon.maximum_discount !== null) {
        const maximumDiscount = Number(coupon.maximum_discount);

        if (Number.isFinite(maximumDiscount) && maximumDiscount >= 0) {
          couponDiscount = Math.min(couponDiscount, maximumDiscount);
        }
      }

      couponDiscount = Number(
        Math.min(subtotal, Math.max(0, couponDiscount)).toFixed(2),
      );
    }

    const totalAmount = Number(
      Math.max(0, subtotal + totalTax + shippingFee - couponDiscount).toFixed(
        2,
      ),
    );

    const orderNumber = `SS-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (user_id, order_number, billing_address_id,
        shipping_address_id, shipping_method_id, shipping_zone_id,
        payment_method,
        subtotal, discount, coupon_discount, tax,
        shipping_fee, total_amount, coupon_id,
        payment_status, order_status,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?,
               'pending', 'pending', NOW(), NOW())`,
      [
        userId,
        orderNumber,
        Number(billing_address_id),
        Number(shipping_address_id),
        shippingMethodId,
        shippingZoneId,
        paymentMethodName,
        subtotal,
        couponDiscount,
        totalTax,
        shippingFee,
        totalAmount,
        couponId,
      ],
    );

    const orderId = orderResult.insertId;

    // Automatically create shipment with tracking details.
    // The courier name is a placeholder; this does not book a real courier.
    let selectedShippingMethod = null;

    if (shippingMethodId !== null) {
      const [shipmentMethods] = await connection.query(
        `SELECT id, name, estimated_days
         FROM shipping_methods
         WHERE id = ? AND status = 'active'
         LIMIT 1
         FOR UPDATE`,
        [shippingMethodId],
      );

      if (shipmentMethods.length === 0) {
        throw new Error("Active shipping method not found for shipment");
      }

      selectedShippingMethod = shipmentMethods[0];
    } else {
      throw new Error("A shipping method is required to create a shipment");
    }

    const estimatedDaysText = String(
      selectedShippingMethod.estimated_days ?? "",
    ).trim();

    // Supports estimates such as "3-5 days", "1-2", and "3 days".
    // If a range is configured, use its maximum value.
    const estimateMatch = estimatedDaysText.match(
      /^(\d+)\s*(?:-\s*(\d+))?(?:\s*days?)?$/i,
    );

    if (!estimateMatch) {
      throw new Error(
        `Invalid estimated_days configuration for shipping method ${shippingMethodId}`,
      );
    }

    const minimumDays = Number(estimateMatch[1]);
    const maximumDays = Number(estimateMatch[2] ?? estimateMatch[1]);

    if (
      !Number.isSafeInteger(minimumDays) ||
      !Number.isSafeInteger(maximumDays) ||
      minimumDays < 0 ||
      maximumDays < minimumDays ||
      maximumDays > 365
    ) {
      throw new Error(
        `Invalid delivery estimate for shipping method ${shippingMethodId}`,
      );
    }

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + maximumDays);

    const expectedDeliveryDate = [
      expectedDate.getFullYear(),
      String(expectedDate.getMonth() + 1).padStart(2, "0"),
      String(expectedDate.getDate()).padStart(2, "0"),
    ].join("-");

    const trackingNumber =
      `SS-TRACK-${orderId}-` +
      crypto.randomBytes(6).toString("hex").toUpperCase();

    const courierName = "ShopSphere Logistics";

    const [shipmentResult] = await connection.query(
      `INSERT INTO shipments
         (
           order_id,
           shipping_method_id,
           courier_name,
           tracking_number,
           expected_delivery_date,
           status
         )
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        orderId,
        shippingMethodId,
        courierName,
        trackingNumber,
        expectedDeliveryDate,
      ],
    );

    const shipmentId = shipmentResult.insertId;

    await connection.query(
      `INSERT INTO shipment_tracking
         (shipment_id, status, location, description)
       VALUES (?, 'pending', NULL, ?)`,
      [shipmentId, "Shipment created automatically when the order was placed"],
    );

    console.log("SHIPMENT CREATED", {
      orderId,
      shipmentId,
      shippingMethod: selectedShippingMethod.name,
      courierName,
      trackingNumber,
      expectedDeliveryDate,
    });

    if (couponId !== null) {
      await connection.query(
        `INSERT INTO coupon_usages
         (coupon_id, user_id, order_id,
          discount_amount, used_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [couponId, userId, orderId, couponDiscount],
      );

      const [usageCounts] = await connection.query(
        `SELECT
           COUNT(*) AS total_uses,
           COUNT(DISTINCT user_id) AS total_users
         FROM coupon_usages
         WHERE coupon_id = ?`,
        [couponId],
      );

      const totalUses = Number(usageCounts[0].total_uses);
      const totalUsers = Number(usageCounts[0].total_users);

      const usageLimitReached =
        couponUsageLimit !== null && totalUses >= Number(couponUsageLimit);

      const userLimitReached =
        couponUserLimit !== null &&
        couponUserLimit !== undefined &&
        totalUsers >= Number(couponUserLimit);

      if (usageLimitReached || userLimitReached) {
        await connection.query(
          `UPDATE coupons
           SET status = 'inactive'
           WHERE id = ?`,
          [couponId],
        );
      }
    }

    for (const item of orderItems) {
      await connection.query(
        `INSERT INTO order_items
         (order_id, product_id, variant_id, sku,
          product_name, quantity, unit_price,
          discount, tax, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          orderId,
          item.product_id,
          item.variant_id,
          item.sku,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.tax,
          item.total,
        ],
      );

      if (item.variant_id !== null) {
        const [updateResult] = await connection.query(
          `UPDATE product_variants
           SET stock_quantity = stock_quantity - ?
           WHERE id = ?
             AND product_id = ?
             AND status = 'active'
             AND stock_quantity >= ?`,
          [item.quantity, item.variant_id, item.product_id, item.quantity],
        );

        if (updateResult.affectedRows !== 1) {
          throw new Error(
            `Insufficient variant stock for product ${item.product_id}`,
          );
        }
      } else {
        const [updateResult] = await connection.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?
           WHERE id = ?
             AND status = 'active'
             AND stock_quantity >= ?`,
          [item.quantity, item.product_id, item.quantity],
        );

        if (updateResult.affectedRows !== 1) {
          throw new Error(`Insufficient stock for product ${item.product_id}`);
        }
      }
    }

    await connection.query(
      `INSERT INTO order_status_history
       (order_id, status, note, changed_by, created_at)
       VALUES (?, 'pending', ?, ?, NOW())`,
      [orderId, "Order created", userId],
    );

    if (!isBuyNow) {
      await connection.query(`DELETE FROM cart_items WHERE cart_id = ?`, [
        cartId,
      ]);
    }

    const invoiceNumber = `SS-INV-${orderId}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    await connection.query(
      `INSERT INTO invoices (order_id, invoice_number)
       VALUES (?, ?)`,
      [orderId, invoiceNumber],
    );

    console.log("INVOICE CREATED", {
      orderId,
      invoiceNumber,
    });

    await connection.commit();
    transactionStarted = false;

    try {
      await createNotification({
        userId,
        type: "order_created",
        title: "Order placed successfully",
        message: `Your order ${orderNumber} has been placed successfully.`,
        data: {
          order_id: Number(orderId),
          shipment_id: Number(shipmentId),
          order_number: orderNumber,
          order_status: "pending",
        },
      });
    } catch (notificationError) {
      console.error("Order creation notification error:", notificationError);
    }

    console.log("ORDER COMMITTED - STARTING EMAIL", {
      orderId,
      orderNumber,
      userId,
    });

    try {
      const [userRows] = await db.promise().query(
        `SELECT name, email
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId],
      );

      if (userRows.length === 0 || !userRows[0].email) {
        console.warn(
          "No customer email found for order:",
          orderNumber,
          "userId:",
          userId,
        );
      } else {
        const customer = userRows[0];

        const emailText = [
          `Hello ${customer.name || "Customer"},`,
          "",
          "Thank you for shopping with ShopSphere!",
          "",
          "Your order has been placed successfully.",
          "",
          `Order Number: ${orderNumber}`,
          `Subtotal: INR ${Number(subtotal).toFixed(2)}`,
          "Discount: INR 0.00",
          `Coupon Discount: INR ${Number(couponDiscount).toFixed(2)}`,
          `Tax: INR ${Number(totalTax).toFixed(2)}`,
          `Shipping Fee: INR ${Number(shippingFee).toFixed(2)}`,
          `Grand Total: INR ${Number(totalAmount).toFixed(2)}`,
          "",
          "Order Status: Pending",
          "Payment Status: Pending",
          "",
          "Thank you for choosing ShopSphere.",
        ].join("\n");

        const emailSent = await sendEmail(
          customer.email,
          `ShopSphere Order Confirmation - ${orderNumber}`,
          emailText,
        );

        console.log("ORDER CONFIRMATION EMAIL RESULT:", emailSent);

        if (!emailSent) {
          console.error(
            "Order confirmation email could not be sent:",
            orderNumber,
          );
        }
      }
    } catch (emailError) {
      console.error("Order confirmation email error:", emailError);
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order_id: orderId,
        shipment_id: shipmentId,
        tracking_number: trackingNumber,
        courier_name: courierName,
        expected_delivery_date: expectedDeliveryDate,
        order_number: orderNumber,
        subtotal,
        discount: 0,
        coupon_id: couponId,
        coupon_code: appliedCouponCode,
        coupon_discount: couponDiscount,
        tax: totalTax,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        shipment_status: "pending",
        shipping_zone_id: shippingZoneId,
        delivery_area: deliveryZone?.name ?? null,
        order_status: "pending",
        payment_status: "pending",
        payment_method: paymentMethodName,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Order transaction rollback error:", rollbackError);
      }

      transactionStarted = false;
    }

    console.error("Create order error:", error);

    const isExpectedError =
      error instanceof Error &&
      error.constructor === Error &&
      !error.code &&
      !error.sqlState;

    const statusCode = isExpectedError ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: isExpectedError ? error.message : "Failed to create order",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const getOrders = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [orders] = await db.promise().query(
      `SELECT id, order_number, subtotal, discount,
              coupon_discount, tax, shipping_fee, total_amount,
              payment_method, payment_status, order_status, created_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
    );

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const [orders] = await db.promise().query(
      `SELECT *
       FROM orders
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [orderId, userId],
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const [items] = await db.promise().query(
      `SELECT id, product_id, variant_id, sku, product_name,
              quantity, unit_price, discount, tax, total
       FROM order_items
       WHERE order_id = ?`,
      [orderId],
    );

    return res.status(200).json({
      success: true,
      data: {
        order: orders[0],
        items,
      },
    });
  } catch (error) {
    console.error("Get order details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
    });
  }
};

const cancelOrder = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const userId = req.user.user_id;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [orders] = await connection.query(
      `SELECT id, order_number, order_status, payment_status
       FROM orders
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [orderId, userId],
    );

    if (orders.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = orders[0];

    if (order.order_status !== "pending") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Only pending orders can be cancelled",
      });
    }

    if (order.payment_status === "paid") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Paid orders cannot be cancelled through this API",
      });
    }

    const [items] = await connection.query(
      `SELECT product_id, variant_id, quantity
       FROM order_items
       WHERE order_id = ?`,
      [orderId],
    );

    for (const item of items) {
      if (item.variant_id !== null) {
        await connection.query(
          `UPDATE product_variants
           SET stock_quantity = stock_quantity + ?
           WHERE id = ? AND product_id = ?`,
          [item.quantity, item.variant_id, item.product_id],
        );
      } else {
        await connection.query(
          `UPDATE products
           SET stock_quantity = stock_quantity + ?
           WHERE id = ?`,
          [item.quantity, item.product_id],
        );
      }
    }

    await connection.query(
      `UPDATE orders
       SET order_status = 'cancelled', updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [orderId, userId],
    );

    await connection.query(
      `INSERT INTO order_status_history
       (order_id, status, note, changed_by, created_at)
       VALUES (?, 'cancelled', ?, ?, NOW())`,
      [orderId, "Order cancelled by customer", userId],
    );

    await connection.commit();
    transactionStarted = false;

    try {
      await createNotification({
        userId,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Your order ${order.order_number} has been cancelled successfully.`,
        data: {
          order_id: Number(orderId),
          order_number: order.order_number,
          previous_status: "pending",
          order_status: "cancelled",
        },
      });
    } catch (notificationError) {
      console.error(
        "Order cancellation notification error:",
        notificationError,
      );
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        order_id: orderId,
        order_status: "cancelled",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Cancel order rollback error:", rollbackError);
      }
    }

    console.error("Cancel order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const trackOrder = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const [orders] = await db.promise().query(
      `SELECT id, order_number, order_status, payment_status,
              created_at, updated_at
       FROM orders
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [orderId, userId],
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const [history] = await db.promise().query(
      `SELECT status, note, created_at
       FROM order_status_history
       WHERE order_id = ?
       ORDER BY created_at ASC, id ASC`,
      [orderId],
    );

    return res.status(200).json({
      success: true,
      data: {
        order: orders[0],
        tracking_history: history,
      },
    });
  } catch (error) {
    console.error("Track order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to track order",
    });
  }
};

const requestReturn = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const orderId = Number(req.params.orderId);
    const orderItemId = Number(req.body.order_item_id);
    const quantity = Number(req.body.quantity);
    const reason = req.body.reason;
    const userId = req.user.user_id;

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0 ||
      !Number.isInteger(orderItemId) ||
      orderItemId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      typeof reason !== "string" ||
      !reason.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid order item, quantity and reason are required",
      });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [orders] = await connection.query(
      `SELECT id, order_status
       FROM orders
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [orderId, userId],
    );

    if (orders.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (orders[0].order_status !== "delivered") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    const [items] = await connection.query(
      `SELECT id, quantity
       FROM order_items
       WHERE id = ? AND order_id = ?
       FOR UPDATE`,
      [orderItemId, orderId],
    );

    if (items.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Invalid order item",
      });
    }

    const orderedQuantity = Number(items[0].quantity);

    if (quantity > orderedQuantity) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Return quantity exceeds the ordered quantity",
      });
    }

    const [existing] = await connection.query(
      `SELECT COALESCE(SUM(quantity), 0) AS returned_quantity
       FROM order_returns
       WHERE order_item_id = ?
         AND status IN ('pending', 'approved', 'completed')`,
      [orderItemId],
    );

    const alreadyRequested = Number(existing[0].returned_quantity);

    if (alreadyRequested + quantity > orderedQuantity) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Return quantity exceeds the remaining quantity",
      });
    }

    const [result] = await connection.query(
      `INSERT INTO order_returns
       (order_id, order_item_id, user_id, quantity, reason, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [orderId, orderItemId, userId, quantity, reason.trim()],
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Return request submitted successfully",
      data: {
        return_id: result.insertId,
        order_id: orderId,
        order_item_id: orderItemId,
        quantity,
        reason: reason.trim(),
        status: "pending",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Return request rollback error:", rollbackError);
      }
    }

    console.error("Request return error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit return request",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  trackOrder,
  requestReturn,
  checkoutSummary,
};
