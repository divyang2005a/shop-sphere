const parsePincodes = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Older rows may contain comma-separated pincodes.
  }

  return value.split(",");
};

const normalizePincode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const getActiveDeliveryZone = async (executor, pincode) => {
  const [zones] = await executor.query(
    `SELECT id, name, pincodes, shipping_fee, free_shipping_threshold
     FROM shipping_zones
     WHERE status = 'active'
     ORDER BY id ASC`,
  );
  const normalizedPincode = normalizePincode(pincode);
  const matches = zones.filter((zone) =>
    parsePincodes(zone.pincodes).some(
      (zonePincode) => normalizePincode(zonePincode) === normalizedPincode,
    ),
  );

  if (matches.length > 1) {
    throw new Error("Delivery pincode matches more than one active delivery area");
  }

  return matches[0] || null;
};

module.exports = {
  getActiveDeliveryZone,
  normalizePincode,
  parsePincodes,
};
