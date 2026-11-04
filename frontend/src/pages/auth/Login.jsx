import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = "http://192.168.1.20:5000/api/auth";

function Login() {
  const navigate = useNavigate();
  const otpRefs = useRef([]);

  // Login states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [loginUserId, setLoginUserId] = useState(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpLoading, setOtpLoading] = useState(false);

  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotUserId, setForgotUserId] = useState(null);
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  // ========================================
  // LOGIN
  // ========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      if (!data.otp_required || !data.user_id) {
        throw new Error("OTP information was not received from the server.");
      }

      setLoginUserId(data.user_id);
      setOtp(["", "", "", "", "", ""]);
      setShowOtpModal(true);
      setSuccess(data.message || "OTP sent to your email.");

      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError(err.message || "Unable to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // OTP INPUT
  // ========================================
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);

    setOtp((previous) => {
      const updated = [...previous];
      updated[index] = digit;
      return updated;
    });

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    const digits = Array.from(
      { length: 6 },
      (_, index) => pasted[index] || ""
    );

    setOtp(digits);

    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  // ========================================
  // VERIFY LOGIN OTP
  // ========================================
  const verifyOtp = async (e) => {
    if (e) e.preventDefault();

    setError("");

    const enteredOtp = otp.join("");

    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    if (!loginUserId) {
      setError("Login session expired. Please login again.");
      return;
    }

    try {
      setOtpLoading(true);

      const response = await fetch(`${API_URL}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: loginUserId,
          otp: enteredOtp,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "OTP verification failed.");
      }

      if (!data.token || !data.user) {
        throw new Error("Login token or user details were not received.");
      }

      const user = data.user;
      const roleId = Number(user.role_id);

      if (roleId !== 1 && roleId !== 2) {
        throw new Error("Your account does not have a valid role.");
      }

      // Save authenticated session details
      localStorage.setItem("shopsphereToken", data.token);
      localStorage.setItem("shopsphereCurrentUser", JSON.stringify(user));
      localStorage.setItem("shopsphereLoggedIn", "true");

      setShowOtpModal(false);
      setLoginUserId(null);

      // Role ID 1 = Admin, Role ID 2 = User
      if (roleId === 1) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Unable to verify OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const closeOtpModal = () => {
    setShowOtpModal(false);
    setLoginUserId(null);
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setSuccess("");
  };

  // ========================================
  // FORGOT PASSWORD - SEND OTP
  // ========================================
  const handleForgotPassword = async (e) => {
    e.preventDefault();

    setForgotError("");
    setMessage("");

    if (!forgotEmail.trim()) {
      setForgotError("Please enter your registered email.");
      return;
    }

    try {
      setForgotLoading(true);

      const response = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to send reset OTP.");
      }

      if (!data.user_id) {
        throw new Error("User information was not received from the server.");
      }

      setForgotUserId(data.user_id);
      setForgotOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setForgotStep(2);
      setMessage(data.message || "Password reset OTP sent to your email.");
    } catch (err) {
      setForgotError(err.message || "Unable to send OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  // ========================================
  // RESET PASSWORD
  // ========================================
  const handleResetPassword = async (e) => {
    e.preventDefault();

    setForgotError("");
    setMessage("");

    if (!forgotUserId) {
      setForgotError("Please request a password reset OTP again.");
      return;
    }

    if (!/^\d{6}$/.test(forgotOtp)) {
      setForgotError("Please enter a valid 6-digit OTP.");
      return;
    }

    if (newPassword.length < 6) {
      setForgotError("Password must contain at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    try {
      setForgotLoading(true);

      const response = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: forgotUserId,
          otp: forgotOtp,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Password reset failed.");
      }

      setMessage(data.message || "Password reset successfully.");

      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotEmail("");
        setForgotUserId(null);
        setForgotOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setForgotError("");
        setMessage("");
        setPassword("");
      }, 1200);
    } catch (err) {
      setForgotError(err.message || "Unable to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotEmail("");
    setForgotUserId(null);
    setForgotOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotError("");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-aqua-spring flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="grid min-h-[600px] grid-cols-1 md:grid-cols-2">

          {/* LEFT SIDE */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-cyprus p-10 text-white md:flex">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-ocean-green/30 blur-2xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-surf-crest/20 blur-2xl" />

            <Link to="/" className="relative z-10 text-3xl font-bold">
              <span className="text-ocean-green">Shop</span>
              <span className="text-white">Sphere</span>
            </Link>

            <div className="relative z-10">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
                <i className="fa-solid fa-bag-shopping" />
              </div>

              <h1 className="mb-4 text-4xl font-bold leading-tight">
                Welcome back to ShopSphere
              </h1>

              <p className="max-w-sm text-base leading-7 text-white/75">
                Discover products you love, manage your orders, and enjoy a
                smooth shopping experience.
              </p>

              <div className="mt-8 space-y-4 text-sm text-white/85">
                <p>
                  <i className="fa-solid fa-circle-check mr-3 text-surf-crest" />
                  Easy and secure login
                </p>
                <p>
                  <i className="fa-solid fa-circle-check mr-3 text-surf-crest" />
                  Track your orders anytime
                </p>
                <p>
                  <i className="fa-solid fa-circle-check mr-3 text-surf-crest" />
                  Manage your account in one place
                </p>
              </div>
            </div>

            <p className="relative z-10 text-sm text-white/60">
              Your everyday shopping destination.
            </p>
          </div>

          {/* RIGHT SIDE: LOGIN FORM */}
          <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
            <div className="w-full max-w-md">
              <Link to="/" className="mb-8 inline-block text-2xl font-bold md:hidden">
                <span className="text-ocean-green">Shop</span>
                <span className="text-cyprus">Sphere</span>
              </Link>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-cyprus">
                  Welcome Back!
                </h2>
                <p className="mt-2 text-sm text-text-grey">
                  Sign in to your ShopSphere account
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
                  {error}
                </div>
              )}

              {success && !showOtpModal && (
                <div className="mb-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-cyprus">
                    Email Address
                  </label>
                  <div className="flex items-center rounded-xl border border-gray-200 px-4 transition focus-within:border-ocean-green focus-within:ring-2 focus-within:ring-ocean-green/20">
                    <i className="fa-regular fa-envelope text-text-grey" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-cyprus outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-semibold text-cyprus">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotStep(1);
                        setForgotError("");
                        setMessage("");
                        setShowForgotModal(true);
                      }}
                      className="text-sm font-semibold text-ocean-green hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <div className="flex items-center rounded-xl border border-gray-200 px-4 transition focus-within:border-ocean-green focus-within:ring-2 focus-within:ring-ocean-green/20">
                    <i className="fa-solid fa-lock text-text-grey" />
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-cyprus outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean-green py-3.5 font-semibold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <i className="fa-solid fa-arrow-right" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-text-grey">
                Don't have an account?{" "}
                <Link to="/register" className="font-semibold text-ocean-green hover:underline">
                  Create Account
                </Link>
              </p>

              <p className="mt-8 text-center text-xs text-text-grey">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          LOGIN OTP MODAL
      ======================================== */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-xl text-ocean-green">
                <i className="fa-solid fa-envelope-circle-check" />
              </div>

              <button
                type="button"
                onClick={closeOtpModal}
                className="flex h-9 w-9 items-center justify-center rounded-full text-text-grey hover:bg-gray-100"
                aria-label="Close OTP modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <h3 className="text-2xl font-bold text-cyprus">
              Verify Your Email
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-grey">
              Enter the 6-digit login OTP sent to your registered email address.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">
                {error}
              </div>
            )}

            <form onSubmit={verifyOtp}>
              <div className="mt-6 flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    aria-label={`OTP digit ${index + 1}`}
                    className="h-12 w-11 rounded-lg border border-gray-200 text-center text-lg font-bold text-cyprus outline-none focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20 sm:h-14 sm:w-12"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={otpLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-ocean-green py-3.5 font-semibold text-white hover:bg-cyprus disabled:opacity-60"
              >
                {otpLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify OTP"
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-text-grey">
              OTP expires after 5 minutes. If it expires, close this window and login again to request a new OTP.
            </p>
          </div>
        </div>
      )}

      {/* ========================================
          FORGOT PASSWORD MODAL
      ======================================== */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-xl text-ocean-green">
                <i className="fa-solid fa-key" />
              </div>

              <button
                type="button"
                onClick={closeForgotModal}
                className="flex h-9 w-9 items-center justify-center rounded-full text-text-grey hover:bg-gray-100"
                aria-label="Close forgot password modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <h3 className="text-2xl font-bold text-cyprus">
              {forgotStep === 1 ? "Forgot Password?" : "Reset Password"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-text-grey">
              {forgotStep === 1
                ? "Enter your registered email address to receive a password reset OTP."
                : "Enter the OTP sent to your email and choose a new password."}
            </p>

            {forgotError && (
              <div className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">
                {forgotError}
              </div>
            )}

            {message && (
              <div className="mt-4 rounded-lg bg-success/10 p-3 text-sm text-success">
                {message}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="forgotEmail" className="mb-2 block text-sm font-semibold text-cyprus">
                    Registered Email
                  </label>
                  <input
                    id="forgotEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your registered email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean-green py-3.5 font-semibold text-white hover:bg-cyprus disabled:opacity-60"
                >
                  {forgotLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    "Send Reset OTP"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="forgotOtp" className="mb-2 block text-sm font-semibold text-cyprus">
                    6-Digit OTP
                  </label>
                  <input
                    id="forgotOtp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="Enter reset OTP"
                    value={forgotOtp}
                    onChange={(e) =>
                      setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm tracking-widest outline-none focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="mb-2 block text-sm font-semibold text-cyprus">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-cyprus">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean-green py-3.5 font-semibold text-white hover:bg-cyprus disabled:opacity-60"
                >
                  {forgotLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={closeForgotModal}
              className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-cyprus hover:bg-gray-50"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;