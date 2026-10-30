const containsSensitivePaymentCredentials = (value) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const isSensitiveKey =
      normalizedKey.includes("card") ||
      normalizedKey.includes("cvv") ||
      normalizedKey.includes("cvc") ||
      normalizedKey.includes("upipin") ||
      normalizedKey === "pin" ||
      normalizedKey === "otp" ||
      normalizedKey.includes("onetimepassword") ||
      normalizedKey.includes("paymentcredential") ||
      normalizedKey.includes("paymenttoken");

    return isSensitiveKey || containsSensitivePaymentCredentials(child);
  });
};

const rejectPaymentCredentials = (req, res, next) => {
  if (containsSensitivePaymentCredentials(req.body)) {
    return res.status(400).json({
      success: false,
      message:
        "Do not submit card details, UPI PINs, OTPs, or payment credentials; this backend does not process gateway payments",
    });
  }

  return next();
};

module.exports = rejectPaymentCredentials;
