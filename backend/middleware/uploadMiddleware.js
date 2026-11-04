const createImageUpload = require("./createImageUpload");

module.exports = createImageUpload({
  directory: "products",
  maxWidth: 1600,
  maxHeight: 1600,
});
