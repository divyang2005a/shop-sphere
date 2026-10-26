const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendEmail = async (to, subject, text) => {
  try {
    console.log("Attempting to send email to:", to);

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });

    console.log("Email accepted by SMTP:", info.accepted);
    console.log("Email rejected by SMTP:", info.rejected);
    console.log("Email message ID:", info.messageId);

    return true;
  } catch (error) {
    console.error("SMTP email error:", error);
    return false;
  }
};


const verifySMTP = async () => {
  try {
    await transporter.verify();
    console.log("SMTP connection successful..");
  } catch (error) {
    console.error("SMTP connection failed..", error.message);
  }
};

module.exports = {
  sendEmail,
  verifySMTP,
};