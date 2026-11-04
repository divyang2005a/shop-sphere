const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const createImageUpload = ({
  directory,
  maxWidth = 1920,
  maxHeight = 1920,
  allowSvg = false,
}) => {
  const uploadDir = path.join(__dirname, "..", "uploads", directory);
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, callback) => {
      if (
        !allowedTypes.has(file.mimetype) ||
        (!allowSvg && file.mimetype === "image/svg+xml")
      ) {
        const error = new Error(
          "Only JPG, PNG, WEBP, and GIF images are allowed",
        );
        error.status = 400;
        return callback(error);
      }

      return callback(null, true);
    },
    limits: {
      fileSize: 15 * 1024 * 1024,
      files: 2,
    },
  });

  const compressFiles = async (req) => {
    const files = req.file
      ? [req.file]
      : Object.values(req.files || {}).flat();

    if (!files.length) return;

    await fs.mkdir(uploadDir, { recursive: true });

    const writtenPaths = [];
    try {
      for (const file of files) {
        const filename =
          `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
        const outputPath = path.join(uploadDir, filename);

        const image = sharp(file.buffer, {
          animated: file.mimetype === "image/gif",
          limitInputPixels: 60_000_000,
        });

        await image
          .rotate()
          .resize({
            width: maxWidth,
            height: maxHeight,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82, effort: 4 })
          .toFile(outputPath);

        writtenPaths.push(outputPath);
        file.destination = uploadDir;
        file.filename = filename;
        file.path = outputPath;
        file.mimetype = "image/webp";
        file.size = (await fs.stat(outputPath)).size;
        delete file.buffer;
      }
    } catch (error) {
      await Promise.all(
        writtenPaths.map((filePath) =>
          fs.unlink(filePath).catch((cleanupError) => {
            if (cleanupError.code !== "ENOENT") {
              console.error("Compressed image cleanup error:", cleanupError);
            }
          }),
        ),
      );
      throw error;
    }
  };

  const wrap = (method) =>
    (...args) =>
    (req, res, next) => {
      upload[method](...args)(req, res, (uploadError) => {
        if (uploadError) return next(uploadError);

        compressFiles(req)
          .then(() => next())
          .catch((error) => {
            console.error("Image compression error:", error);
            error.status =
              error.status ||
              (error.code === "EACCES" || error.code === "ENOSPC" ? 500 : 400);
            next(error);
          });
      });
    };

  return {
    single: wrap("single"),
    fields: wrap("fields"),
  };
};

module.exports = createImageUpload;
