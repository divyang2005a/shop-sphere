const createImageUpload = require("./createImageUpload");

module.exports = createImageUpload({
  directory: "brandlogo",
  maxWidth: 1200,
  maxHeight: 1200,
  allowSvg: true,
});
