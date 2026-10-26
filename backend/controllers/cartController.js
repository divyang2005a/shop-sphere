
const db = require("../config/db");

// GET CART
const getCart = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [carts] = await db.promise().query(
      `SELECT id, user_id, status, created_at, updated_at
       FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY id DESC
       LIMIT 1`,
      [userId]
    );

    if (carts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: { items: [], total: 0 }
      });
    }

    const [items] = await db.promise().query(
      `SELECT
         ci.id AS cart_item_id,
         ci.product_id,
         ci.variant_id,
         ci.quantity,
         ci.unit_price,
         (ci.quantity * ci.unit_price) AS subtotal,
         p.title,
         p.sku,
         p.stock_quantity AS product_stock,
         pv.variant_name,
         pv.sku AS variant_sku,
         pv.stock_quantity AS variant_stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants pv ON pv.id = ci.variant_id
       WHERE ci.cart_id = ?
       ORDER BY ci.id DESC`,
      [carts[0].id]
    );

    const total = items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        cart: carts[0],
        items,
        total
      }
    });
  } catch (error) {
    console.error("Get cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart"
    });
  }
};

// ADD PRODUCT TO CART
const addToCart = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    const userId = req.user.user_id;
    const { product_id, variant_id, quantity = 1 } = req.body;

    const productId = Number(product_id);
    const qty = Number(quantity);

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(qty) ||
      qty <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product_id and positive quantity are required"
      });
    }

    const variantId =
      variant_id === undefined ||
      variant_id === null ||
      variant_id === ""
        ? null
        : Number(variant_id);

    if (
      variantId !== null &&
      (!Number.isInteger(variantId) || variantId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant_id"
      });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [products] = await connection.query(
      `SELECT id, title, base_price, sale_price, stock_quantity, status
       FROM products
       WHERE id = ?
       FOR UPDATE`,
      [productId]
    );

    if (products.length === 0 || products[0].status !== "active") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Active product not found"
      });
    }

    const product = products[0];
    let stock = Number(product.stock_quantity ?? 0);
    let price = Number(product.sale_price ?? product.base_price);

    if (variantId !== null) {
      const [variants] = await connection.query(
        `SELECT id, product_id, price, stock_quantity, status
         FROM product_variants
         WHERE id = ? AND product_id = ?
         FOR UPDATE`,
        [variantId, productId]
      );

      if (variants.length === 0 || variants[0].status !== "active") {
        await connection.rollback();
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Active variant not found for this product"
        });
      }

      stock = Number(variants[0].stock_quantity ?? 0);

      if (variants[0].price !== null) {
        price = Number(variants[0].price);
      }
    }

    if (!Number.isFinite(stock) || stock < 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Invalid product stock"
      });
    }

    if (!Number.isFinite(price) || price < 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Invalid product price"
      });
    }

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
      const [result] = await connection.query(
        `INSERT INTO carts (user_id, status, created_at, updated_at)
         VALUES (?, 'active', NOW(), NOW())`,
        [userId]
      );

      cartId = result.insertId;
    }

    const [items] = await connection.query(
      `SELECT id, quantity
       FROM cart_items
       WHERE cart_id = ?
         AND product_id = ?
         AND (variant_id <=> ?)
       FOR UPDATE`,
      [cartId, productId, variantId]
    );

    const newQuantity =
      items.length > 0
        ? Number(items[0].quantity) + qty
        : qty;

    if (newQuantity > stock) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Insufficient stock",
        available_stock: stock
      });
    }

    if (items.length > 0) {
      await connection.query(
        `UPDATE cart_items
         SET quantity = ?, unit_price = ?, updated_at = NOW()
         WHERE id = ?`,
        [newQuantity, price, items[0].id]
      );
    } else {
      await connection.query(
        `INSERT INTO cart_items
         (cart_id, product_id, variant_id, quantity, unit_price,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [cartId, productId, variantId, qty, price]
      );
    }

    await connection.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = ?`,
      [cartId]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Item added to cart successfully",
      quantity: newQuantity,
      unit_price: price,
      subtotal: newQuantity * price
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Add to cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add item to cart"
    });
  } finally {
    if (connection) connection.release();
  }
};

// INCREASE OR DECREASE CART ITEM QUANTITY
const updateCartItem = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    const userId = req.user.user_id;
    const cartItemId = Number(req.params.itemId);
    const quantity = Number(req.body.quantity);

    if (
      !Number.isInteger(cartItemId) ||
      cartItemId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid item ID and positive quantity are required"
      });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [items] = await connection.query(
      `SELECT
         ci.id,
         ci.product_id,
         ci.variant_id,
         ci.quantity AS old_quantity,
         ci.unit_price,
         c.id AS cart_id,
         p.stock_quantity AS product_stock,
         p.status AS product_status,
         pv.stock_quantity AS variant_stock,
         pv.status AS variant_status
       FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants pv ON pv.id = ci.variant_id
       WHERE ci.id = ?
         AND c.user_id = ?
         AND c.status = 'active'
       FOR UPDATE`,
      [cartItemId, userId]
    );

    if (items.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    const item = items[0];

    if (item.product_status !== "active") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "This product is no longer available"
      });
    }

    if (
      item.variant_id !== null &&
      item.variant_status !== "active"
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "This product variant is no longer available"
      });
    }

    const stock =
      item.variant_id !== null
        ? Number(item.variant_stock ?? 0)
        : Number(item.product_stock ?? 0);

    if (!Number.isFinite(stock) || stock < 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Invalid product stock"
      });
    }

    if (quantity > stock) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Insufficient stock",
        current_quantity: Number(item.old_quantity),
        available_stock: stock
      });
    }

    await connection.query(
      `UPDATE cart_items
       SET quantity = ?, updated_at = NOW()
       WHERE id = ?`,
      [quantity, cartItemId]
    );

    await connection.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = ?`,
      [item.cart_id]
    );

    await connection.commit();
    transactionStarted = false;

    const [updatedItems] = await db.promise().query(
      `SELECT
         ci.id AS cart_item_id,
         ci.product_id,
         ci.variant_id,
         ci.quantity,
         ci.unit_price,
         (ci.quantity * ci.unit_price) AS subtotal,
         p.title
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.id = ?`,
      [cartItemId]
    );

    const [totals] = await db.promise().query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) AS total
       FROM cart_items
       WHERE cart_id = ?`,
      [item.cart_id]
    );

    return res.status(200).json({
      success: true,
      message: "Cart item quantity updated successfully",
      data: {
        item: updatedItems[0],
        total: Number(totals[0].total)
      }
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Update cart item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update cart item"
    });
  } finally {
    if (connection) connection.release();
  }
};

// REMOVE ONE CART ITEM
const removeCartItem = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    const userId = req.user.user_id;
    const cartItemId = Number(req.params.itemId);

    if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid cart item ID is required"
      });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [items] = await connection.query(
      `SELECT ci.id, ci.cart_id
       FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
       WHERE ci.id = ?
         AND c.user_id = ?
         AND c.status = 'active'
       FOR UPDATE`,
      [cartItemId, userId]
    );

    if (items.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    await connection.query(
      `DELETE FROM cart_items WHERE id = ?`,
      [cartItemId]
    );

    await connection.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = ?`,
      [items[0].cart_id]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: "Cart item removed successfully"
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Remove cart item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove cart item"
    });
  } finally {
    if (connection) connection.release();
  }
};

// CLEAR CART
const clearCart = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    const userId = req.user.user_id;

    await connection.beginTransaction();
    transactionStarted = true;

    const [carts] = await connection.query(
      `SELECT id
       FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (carts.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        message: "Cart is already empty"
      });
    }

    await connection.query(
      `DELETE FROM cart_items WHERE cart_id = ?`,
      [carts[0].id]
    );

    await connection.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = ?`,
      [carts[0].id]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully"
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Clear cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to clear cart"
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
};
