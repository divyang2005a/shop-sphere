const createImageUpload = require("./createImageUpload");

module.exports = createImageUpload({
  directory: "banners",
  maxWidth: 1920,
  maxHeight: 1200,
});
