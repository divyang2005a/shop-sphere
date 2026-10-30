const db = require("../config/db");

const isValidId = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

const parseBannerFields = (body, { partial = false, uploadedImage } = {}) => {
  const fields = {};
  const has = (key) => Object.hasOwn(body, key);

  if (!partial || has("title")) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 255
    ) {
      return { error: "Banner title is required (maximum 255 characters)" };
    }
    fields.title = body.title.trim();
  }

  if (!partial || uploadedImage || has("image")) {
    const image = uploadedImage || body.image;
    if (
      typeof image !== "string" ||
      !image.trim() ||
      image.trim().length > 500
    ) {
      return {
        error: "A banner image is required (maximum 500 characters)",
      };
    }
    fields.image = image.trim();
  }

  if (!partial || has("link")) {
    const link = body.link;
    if (
      link !== undefined &&
      link !== null &&
      (typeof link !== "string" || link.length > 500)
    ) {
      return { error: "Banner link must be at most 500 characters" };
    }
    fields.link = typeof link === "string" ? link.trim() || null : null;
  }

  for (const field of ["start_date", "end_date"]) {
    if (!partial || has(field)) {
      const value = body[field];
      if (value !== undefined && value !== null && value !== "") {
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
          return { error: `${field} must be a valid date/time or null` };
        }
        fields[field] = new Date(value)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
      } else {
        fields[field] = null;
      }
    }
  }

  if (!partial || has("status")) {
    const status = body.status === undefined ? "active" : body.status;
    if (
      typeof status !== "string" ||
      !["active", "inactive"].includes(status.trim().toLowerCase())
    ) {
      return { error: "Banner status must be active or inactive" };
    }
    fields.status = status.trim().toLowerCase();
  }

  if (!partial || has("sort_order")) {
    const sortOrder =
      body.sort_order === undefined ? 0 : Number(body.sort_order);
    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
      return { error: "sort_order must be a non-negative integer" };
    }
    fields.sort_order = sortOrder;
  }

  if (
    fields.start_date &&
    fields.end_date &&
    new Date(fields.end_date) < new Date(fields.start_date)
  ) {
    return { error: "end_date cannot be earlier than start_date" };
  }

  return { fields };
};

const getBanners = async (req, res) => {
  try {
    const [banners] = await db.promise().execute(
      `SELECT id, title, image, link, start_date, end_date, status, sort_order
       FROM banners
       ORDER BY sort_order ASC, id DESC`,
    );
    return res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    console.error("Get admin banners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

const getActiveBanners = async (_req, res) => {
  try {
    const [banners] = await db.promise().execute(
      `SELECT id, title, image, link, start_date, end_date, sort_order
       FROM banners
       WHERE status = 'active'
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())
       ORDER BY sort_order ASC, id DESC`,
    );
    return res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    console.error("Get active banners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active banners",
    });
  }
};

const createBanner = async (req, res) => {
  const uploadedImage = req.file
    ? `/uploads/banners/${req.file.filename}`
    : undefined;
  const parsed = parseBannerFields(req.body || {}, { uploadedImage });
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  try {
    const { fields } = parsed;
    const [result] = await db.promise().execute(
      `INSERT INTO banners
         (title, image, link, start_date, end_date, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fields.title,
        fields.image,
        fields.link,
        fields.start_date,
        fields.end_date,
        fields.status,
        fields.sort_order,
      ],
    );
    return res.status(201).json({
      success: true,
      message: "Banner created",
      banner_id: result.insertId,
    });
  } catch (error) {
    console.error("Create banner error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create banner",
    });
  }
};

const updateBanner = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid banner ID is required",
    });
  }

  const uploadedImage = req.file
    ? `/uploads/banners/${req.file.filename}`
    : undefined;
  const parsed = parseBannerFields(req.body || {}, {
    partial: true,
    uploadedImage,
  });
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  const entries = Object.entries(parsed.fields);
  if (!entries.length) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one banner field to update",
    });
  }

  try {
    const [existing] = await db.promise().execute(
      "SELECT start_date, end_date FROM banners WHERE id = ?",
      [id],
    );
    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    const effectiveStartDate = Object.hasOwn(parsed.fields, "start_date")
      ? parsed.fields.start_date
      : existing[0].start_date;
    const effectiveEndDate = Object.hasOwn(parsed.fields, "end_date")
      ? parsed.fields.end_date
      : existing[0].end_date;
    if (
      effectiveStartDate &&
      effectiveEndDate &&
      new Date(effectiveEndDate) < new Date(effectiveStartDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "end_date cannot be earlier than start_date",
      });
    }

    const [result] = await db.promise().execute(
      `UPDATE banners
       SET ${entries.map(([field]) => `${field} = ?`).join(", ")}
       WHERE id = ?`,
      [...entries.map(([, value]) => value), id],
    );

    return res.status(200).json({
      success: true,
      message: "Banner updated",
    });
  } catch (error) {
    console.error("Update banner error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update banner",
    });
  }
};

const deleteBanner = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid banner ID is required",
    });
  }

  try {
    const [result] = await db.promise().execute(
      "DELETE FROM banners WHERE id = ?",
      [id],
    );
    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Banner deleted",
    });
  } catch (error) {
    console.error("Delete banner error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete banner",
    });
  }
};

const getSettings = async (_req, res) => {
  try {
    const [settings] = await db.promise().execute(
      `SELECT id, \`key\`, value, type, description, updated_at
       FROM settings
       ORDER BY \`key\` ASC, id ASC`,
    );
    return res.status(200).json({
      success: true,
      count: settings.length,
      settings,
    });
  } catch (error) {
    console.error("Get admin settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
    });
  }
};

const createSetting = async (req, res) => {
  const { key, value = null, type = null, description = null } = req.body || {};
  if (typeof key !== "string" || !key.trim() || key.trim().length > 191) {
    return res.status(400).json({
      success: false,
      message: "Setting key is required and must be at most 191 characters",
    });
  }
  if (value !== null && typeof value !== "string") {
    return res.status(400).json({
      success: false,
      message: "Setting value must be a string or null",
    });
  }
  if (type !== null && (typeof type !== "string" || type.length > 50)) {
    return res.status(400).json({
      success: false,
      message: "Setting type must be at most 50 characters or null",
    });
  }
  if (description !== null && typeof description !== "string") {
    return res.status(400).json({
      success: false,
      message: "Setting description must be a string or null",
    });
  }

  try {
    const [result] = await db.promise().execute(
      `INSERT INTO settings (\`key\`, value, type, description)
       VALUES (?, ?, ?, ?)`,
      [key.trim(), value, type, description],
    );
    return res.status(201).json({
      success: true,
      message: "Setting created",
      setting_id: result.insertId,
    });
  } catch (error) {
    console.error("Create admin setting error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create setting",
    });
  }
};

const updateSetting = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid setting ID is required",
    });
  }

  const body = req.body || {};
  const fields = [];
  const values = [];
  const fieldDefinitions = [
    [
      "key",
      "key",
      (value) =>
        typeof value === "string" &&
        !!value.trim() &&
        value.trim().length <= 191,
    ],
    ["value", "value", (value) => value === null || typeof value === "string"],
    [
      "type",
      "type",
      (value) =>
        value === null || (typeof value === "string" && value.length <= 50),
    ],
    ["description", "description", (value) => value === null || typeof value === "string"],
  ];

  for (const [inputName, columnName, isValid] of fieldDefinitions) {
    if (!Object.hasOwn(body, inputName)) {
      continue;
    }
    const value = body[inputName];
    if (!isValid(value)) {
      return res.status(400).json({
        success: false,
        message: `Invalid setting ${inputName}`,
      });
    }
    fields.push(`\`${columnName}\` = ?`);
    values.push(inputName === "key" ? value.trim() : value);
  }

  if (!fields.length) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one setting field to update",
    });
  }

  try {
    const [result] = await db.promise().execute(
      `UPDATE settings SET ${fields.join(", ")} WHERE id = ?`,
      [...values, id],
    );
    if (!result.affectedRows) {
      const [existing] = await db.promise().execute(
        "SELECT id FROM settings WHERE id = ?",
        [id],
      );
      if (!existing.length) {
        return res.status(404).json({
          success: false,
          message: "Setting not found",
        });
      }
    }
    return res.status(200).json({
      success: true,
      message: "Setting updated",
    });
  } catch (error) {
    console.error("Update admin setting error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update setting",
    });
  }
};

const deleteSetting = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid setting ID is required",
    });
  }
  try {
    const [result] = await db.promise().execute(
      "DELETE FROM settings WHERE id = ?",
      [id],
    );
    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Setting deleted",
    });
  } catch (error) {
    console.error("Delete admin setting error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete setting",
    });
  }
};

module.exports = {
  getBanners,
  getActiveBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getSettings,
  createSetting,
  updateSetting,
  deleteSetting,
};
