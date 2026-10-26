const { rateLimit } = require("express-rate-limit");

const createLimiter = (limit, message) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-6",
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });
};

const registerLimiter = createLimiter(
  10,
  "Too many registration attempts. Please try again in 15 minutes.",
);

const loginLimiter = createLimiter(
  10,
  "Too many login attempts. Please try again in 15 minutes.",
);

const verifyOtpLimiter = createLimiter(
  10,
  "Too many OTP verification attempts. Please try again in 15 minutes.",
);

const forgotPasswordLimiter = createLimiter(
  5,
  "Too many password reset requests. Please try again in 15 minutes.",
);

const resetPasswordLimiter = createLimiter(
  5,
  "Too many password reset attempts. Please try again in 15 minutes.",
);

const changePasswordLimiter = createLimiter(
  5,
  "Too many change-password attempts. Please try again in 15 minutes.",
);

module.exports = {
  registerLimiter,
  loginLimiter,
  verifyOtpLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
};
