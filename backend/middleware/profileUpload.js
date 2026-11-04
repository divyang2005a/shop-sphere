const createImageUpload = require("./createImageUpload");

module.exports = createImageUpload({
  directory: "profile",
  maxWidth: 512,
  maxHeight: 512,
});
