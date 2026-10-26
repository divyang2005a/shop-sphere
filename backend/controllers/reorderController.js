const db = require("../config/db");

const getUserId = (req) => req.user?.user_id ?? req.user?.id;

const isPositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Reorder / Buy Again
const reorderOrder = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const userId = getUserId(req);
    const orderId = Number(req.params.orderId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (!isPositiveId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required",
      });
    }

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Ensure the order belongs to the logged-in customer.
    const [orders] = await connection.query(
      `SELECT id, order_number
       FROM orders
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      throw createError(404, "Order not found");
    }

    const order = orders[0];

    // Read items from the original order.
    const [orderItems] = await connection.query(
      `SELECT product_id, variant_id, quantity
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC
       FOR UPDATE`,
      [orderId]
    );

    if (orderItems.length === 0) {
      throw createError(400, "This order has no items to reorder");
    }

    // Combine duplicate product/variant lines, if any.
    const itemMap = new Map();

    for (const item of orderItems) {
      const productId = Number(item.product_id);
      const variantId =
        item.variant_id === null
          ? null
          : Number(item.variant_id);
      const quantity = Number(item.quantity);

      if (
        !isPositiveId(productId) ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw createError(
          400,
          "Original order contains invalid product information"
        );
      }

      const key = `${productId}:${variantId ?? "null"}`;

      if (!itemMap.has(key)) {
        itemMap.set(key, {
          product_id: productId,
          variant_id: variantId,
          quantity: 0,
        });
      }

      itemMap.get(key).quantity += quantity;
    }

    // Find or create the customer's active cart.
    const [carts] = await connection.query(
      `SELECT id
       FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    let cartId;

    if (carts.length > 0) {
      cartId = carts[0].id;
    } else {
      const [cartResult] = await connection.query(
        `INSERT INTO carts (user_id, status)
         VALUES (?, 'active')`,
        [userId]
      );

      cartId = cartResult.insertId;
    }

    const addedItems = [];

    // Validate products, prices, variants and stock.
    for (const item of itemMap.values()) {
      const {
        product_id: productId,
        variant_id: variantId,
        quantity,
      } = item;

      const [products] = await connection.query(
        `SELECT id, title, base_price, sale_price,
                stock_quantity, status
         FROM products
         WHERE id = ?
         FOR UPDATE`,
        [productId]
      );

      if (products.length === 0) {
        throw createError(
          409,
          `Product ${productId} from the original order no longer exists`
        );
      }

      const product = products[0];

      if (String(product.status).toLowerCase() !== "active") {
        throw createError(
          409,
          `Product "${product.title}" is currently unavailable`
        );
      }

      let availableStock = Number(product.stock_quantity);
      let unitPrice = Number(
        product.sale_price ?? product.base_price
      );

      if (variantId !== null) {
        const [variants] = await connection.query(
          `SELECT id, price, stock_quantity, status
           FROM product_variants
           WHERE id = ? AND product_id = ?
           FOR UPDATE`,
          [variantId, productId]
        );

        if (variants.length === 0) {
          throw createError(
            409,
            `The selected variant for "${product.title}" no longer exists`
          );
        }

        const variant = variants[0];

        if (String(variant.status).toLowerCase() !== "active") {
          throw createError(
            409,
            `The selected variant for "${product.title}" is unavailable`
          );
        }

        availableStock = Number(variant.stock_quantity);

        if (variant.price !== null) {
          unitPrice = Number(variant.price);
        }
      }

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(availableStock) ||
        availableStock < 0
      ) {
        throw createError(
          409,
          `Current price or stock is invalid for "${product.title}"`
        );
      }

      // Find matching items already in the active cart.
      const [cartItems] = await connection.query(
        `SELECT id, quantity
         FROM cart_items
         WHERE cart_id = ?
           AND product_id = ?
           AND variant_id <=> ?
         ORDER BY id ASC
         FOR UPDATE`,
        [cartId, productId, variantId]
      );

      const existingQuantity = cartItems.reduce(
        (total, cartItem) => {
          const quantityInCart = Number(cartItem.quantity);

          if (
            !Number.isInteger(quantityInCart) ||
            quantityInCart <= 0
          ) {
            throw createError(
              409,
              `Cart contains an invalid quantity for "${product.title}"`
            );
          }

          return total + quantityInCart;
        },
        0
      );

      const finalQuantity = existingQuantity + quantity;

      if (finalQuantity > availableStock) {
        throw createError(
          409,
          `Insufficient stock for "${product.title}". ` +
            `Available: ${availableStock}, already in cart: ${existingQuantity}, ` +
            `requested again: ${quantity}`
        );
      }

      if (cartItems.length > 0) {
        // Merge into the first matching cart row.
        await connection.query(
          `UPDATE cart_items
           SET quantity = ?, unit_price = ?
           WHERE id = ?`,
          [finalQuantity, unitPrice, cartItems[0].id]
        );

        // Consolidate any duplicate cart rows for this product/variant.
        if (cartItems.length > 1) {
          const duplicateIds = cartItems
            .slice(1)
            .map((cartItem) => cartItem.id);

          const placeholders = duplicateIds.map(() => "?").join(", ");

          await connection.query(
            `DELETE FROM cart_items
             WHERE id IN (${placeholders})`,
            duplicateIds
          );
        }
      } else {
        await connection.query(
          `INSERT INTO cart_items
            (cart_id, product_id, variant_id, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?)`,
          [cartId, productId, variantId, quantity, unitPrice]
        );
      }

      addedItems.push({
        product_id: productId,
        variant_id: variantId,
        title: product.title,
        quantity_added: quantity,
        cart_quantity: finalQuantity,
        unit_price: unitPrice,
      });
    }

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: "Order items added to cart successfully",
      data: {
        original_order_id: order.id,
        original_order_number: order.order_number,
        cart_id: cartId,
        items_count: addedItems.length,
        items: addedItems,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Reorder rollback error:", rollbackError);
      }

      transactionStarted = false;
    }

    console.error("Reorder order error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to reorder items",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  reorderOrder,
};