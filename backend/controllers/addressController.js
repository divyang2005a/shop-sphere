const db = require("../config/db");

const addAddress = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const {
      type,
      name,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      pincode,
      is_default,
    } = req.body;

    if (
      !type ||
      !name ||
      !phone ||
      !address_line_1 ||
      !city ||
      !state ||
      !country ||
      !pincode
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required address fields",
      });
    }

    const connection = await db.promise().getConnection();

    try {
      await connection.beginTransaction();

      const makeDefault =
        is_default === true || is_default === 1 || is_default === "1";

      if (makeDefault) {
        await connection.query(
          "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
          [userId],
        );
      }

      const [result] = await connection.query(
        `INSERT INTO addresses
        (
          user_id, type, name, phone, address_line_1,
          address_line_2, city, state, country, pincode,
          is_default, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          type,
          name,
          phone,
          address_line_1,
          address_line_2 || null,
          city,
          state,
          country,
          pincode,
          makeDefault ? 1 : 0,
        ],
      );

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: "Address added successfully",
        data: {
          id: result.insertId,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Add address error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add address",
    });
  }
};

const getAddresses = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [addresses] = await db.promise().query(
      `SELECT
         id, type, name, phone,
         address_line_1, address_line_2,
         city, state, country, pincode,
         is_default, created_at, updated_at
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, id DESC`,
      [userId],
    );

    return res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error("Get addresses error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const addressId = Number(req.params.addressId);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid address ID is required",
      });
    }

    const {
      type,
      name,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      pincode,
      is_default,
    } = req.body;

    const [existing] = await db
      .promise()
      .query("SELECT id FROM addresses WHERE id = ? AND user_id = ?", [
        addressId,
        userId,
      ]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const fields = {
      type,
      name,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      pincode,
    };

    const updates = [];
    const values = [];

    for (const [field, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        values.push(value === "" && field === "address_line_2" ? null : value);
      }
    }

    if (is_default !== undefined) {
      const makeDefault =
        is_default === true || is_default === 1 || is_default === "1";

      if (makeDefault) {
        const connection = await db.promise().getConnection();

        try {
          await connection.beginTransaction();

          await connection.query(
            "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
            [userId],
          );

          updates.push("is_default = 1");
          updates.push("updated_at = NOW()");
          values.push(addressId, userId);

          await connection.query(
            `UPDATE addresses SET ${updates.join(", ")}
             WHERE id = ? AND user_id = ?`,
            values,
          );

          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }

        return res.status(200).json({
          success: true,
          message: "Address updated successfully",
        });
      }

      updates.push("is_default = 0");
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update",
      });
    }

    updates.push("updated_at = NOW()");
    values.push(addressId, userId);

    await db.promise().query(
      `UPDATE addresses
       SET ${updates.join(", ")}
       WHERE id = ? AND user_id = ?`,
      values,
    );

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
    });
  } catch (error) {
    console.error("Update address error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const addressId = Number(req.params.addressId);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid address ID is required",
      });
    }

    const [result] = await db.promise().query(
      `DELETE FROM addresses
       WHERE id = ? AND user_id = ?`,
      [addressId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete address error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};

module.exports = {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
};
