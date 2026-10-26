
require("dotenv").config();

const { sendEmail } = require("./services/emailService");

async function testEmail() {
  const result = await sendEmail(
    "divyangkatariya2005@gmail.com",
    "ShopSphere SMTP Test",
    "This is a test email from ShopSphere backend."
  );

  console.log("Final sendEmail result:", result);
  process.exit(result ? 0 : 1);
}

testEmail();
