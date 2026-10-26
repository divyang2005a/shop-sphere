const db = require("../config/db");

// Get user's wishlists and products
const getWishlist = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [wishlists] = await db.promise().query(
      `SELECT id, name, created_at
       FROM wishlists
       WHERE user_id = ?
       ORDER BY id DESC`,
      [userId],
    );

    const [items] = await db.promise().query(
      `SELECT
         wi.id AS wishlist_item_id,
         wi.wishlist_id,
         wi.product_id,
         wi.variant_id,
         wi.created_at,
         p.title,
         p.base_price,
         p.sale_price,
         p.stock_status
       FROM wishlist_items wi
       JOIN wishlists w ON w.id = wi.wishlist_id
       JOIN products p ON p.id = wi.product_id
       WHERE w.user_id = ?
       ORDER BY wi.created_at DESC`,
      [userId],
    );

    return res.status(200).json({
      success: true,
      data: { wishlists, items },
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
    });
  }
};

// Add product to wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { product_id, variant_id, wishlist_id } = req.body ?? {};
    const productId = Number(product_id);
    const variantId =
      variant_id === undefined || variant_id === null || variant_id === ""
        ? null
        : Number(variant_id);
    const requestedWishlistId =
      wishlist_id === undefined || wishlist_id === null || wishlist_id === ""
        ? null
        : Number(wishlist_id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid product_id is required",
      });
    }

    const [products] = await db
      .promise()
      .query("SELECT id FROM products WHERE id = ?", [productId]);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (
      variantId !== null &&
      (!Number.isInteger(variantId) || variantId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid variant_id is required",
      });
    }

    if (variantId !== null) {
      const [variants] = await db.promise().query(
        `SELECT id FROM product_variants
         WHERE id = ? AND product_id = ?`,
        [variantId, productId],
      );

      if (variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Variant does not belong to this product",
        });
      }
    }

    let wishlistId = requestedWishlistId;

    if (
      wishlistId !== null &&
      (!Number.isInteger(wishlistId) || wishlistId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid wishlist_id is required",
      });
    }

    if (wishlistId !== null) {
      const [ownedWishlists] = await db
        .promise()
        .query("SELECT id FROM wishlists WHERE id = ? AND user_id = ?", [
          wishlistId,
          userId,
        ]);

      if (ownedWishlists.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Wishlist not found",
        });
      }
    } else {
      const [existingWishlists] = await db
        .promise()
        .query(
          "SELECT id FROM wishlists WHERE user_id = ? ORDER BY id ASC LIMIT 1",
          [userId],
        );

      if (existingWishlists.length > 0) {
        wishlistId = existingWishlists[0].id;
      } else {
        const [result] = await db
          .promise()
          .query("INSERT INTO wishlists (user_id, name) VALUES (?, ?)", [
            userId,
            "My Wishlist",
          ]);

        wishlistId = result.insertId;
      }
    }

    const [existingItems] = await db.promise().query(
      `SELECT id FROM wishlist_items
       WHERE wishlist_id = ?
         AND product_id = ?
         AND (variant_id <=> ?)`,
      [wishlistId, productId, variantId],
    );

    if (existingItems.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Product is already in this wishlist",
      });
    }

    const [result] = await db.promise().query(
      `INSERT INTO wishlist_items (wishlist_id, product_id, variant_id)
       VALUES (?, ?, ?)`,
      [wishlistId, productId, variantId],
    );

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist",
      data: {
        wishlist_item_id: result.insertId,
        wishlist_id: wishlistId,
        product_id: productId,
        variant_id: variantId,
      },
    });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
    });
  }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const itemId = Number(req.params.itemId);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid wishlist item ID is required",
      });
    }

    const [result] = await db.promise().query(
      `DELETE wi FROM wishlist_items wi
       JOIN wishlists w ON w.id = wi.wishlist_id
       WHERE wi.id = ? AND w.user_id = ?`,
      [itemId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist",
    });
  }
};

const moveToCart = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    const userId = req.user.user_id;
    const itemId = Number(req.params.itemId);
    const qty = Number(req.body.quantity ?? 1);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid wishlist item ID is required",
      });
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [wishlistItems] = await connection.query(
      `SELECT
         wi.id,
         wi.product_id,
         wi.variant_id,
         p.title,
         p.base_price,
         p.sale_price,
         p.stock_quantity AS product_stock,
         p.status AS product_status
       FROM wishlist_items wi
       JOIN wishlists w ON w.id = wi.wishlist_id
       JOIN products p ON p.id = wi.product_id
       WHERE wi.id = ? AND w.user_id = ?
       FOR UPDATE`,
      [itemId, userId],
    );

    if (wishlistItems.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Wishlist item or active product not found",
      });
    }

    const item = wishlistItems[0];

    if (item.product_status !== "active") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "This product is not available",
      });
    }

    let stock = Number(item.product_stock ?? 0);
    let price = Number(item.sale_price ?? item.base_price);

    if (item.variant_id !== null) {
      const [variants] = await connection.query(
        `SELECT id, price, stock_quantity, status
         FROM product_variants
         WHERE id = ? AND product_id = ?
         FOR UPDATE`,
        [item.variant_id, item.product_id],
      );

      if (variants.length === 0 || variants[0].status !== "active") {
        await connection.rollback();
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "This product variant is not available",
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
        message: "Invalid product stock",
      });
    }

    if (!Number.isFinite(price) || price < 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Invalid product price",
      });
    }

    const [carts] = await connection.query(
      `SELECT id
       FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId],
    );

    let cartId;

    if (carts.length > 0) {
      cartId = carts[0].id;
    } else {
      const [cartResult] = await connection.query(
        `INSERT INTO carts (user_id, status, created_at, updated_at)
         VALUES (?, 'active', NOW(), NOW())`,
        [userId],
      );

      cartId = cartResult.insertId;
    }

    const [cartItems] = await connection.query(
      `SELECT id, quantity
       FROM cart_items
       WHERE cart_id = ?
         AND product_id = ?
         AND (variant_id <=> ?)
       FOR UPDATE`,
      [cartId, item.product_id, item.variant_id],
    );

    const newQuantity =
      cartItems.length > 0 ? Number(cartItems[0].quantity) + qty : qty;

    if (newQuantity > stock) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Insufficient stock",
        available_stock: stock,
      });
    }

    if (cartItems.length > 0) {
      await connection.query(
        `UPDATE cart_items
         SET quantity = ?, unit_price = ?, updated_at = NOW()
         WHERE id = ?`,
        [newQuantity, price, cartItems[0].id],
      );
    } else {
      await connection.query(
        `INSERT INTO cart_items
         (cart_id, product_id, variant_id, quantity, unit_price,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [cartId, item.product_id, item.variant_id, qty, price],
      );
    }

    await connection.query(`UPDATE carts SET updated_at = NOW() WHERE id = ?`, [
      cartId,
    ]);

    // Wishlist item intentionally remains in the wishlist.
    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: "Product added to cart; it remains in your wishlist",
      data: {
        wishlist_item_id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: newQuantity,
        unit_price: price,
        subtotal: Number((newQuantity * price).toFixed(2)),
        remains_in_wishlist: true,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Move wishlist item to cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add wishlist product to cart",
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};
