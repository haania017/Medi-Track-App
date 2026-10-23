import multer from 'multer';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

/** Memory storage: files are written to private storage by the storage service. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(
        ApiError.badRequest(
          `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, HEIC, PDF.`,
        ),
      );
    }
    return cb(null, true);
  },
});

export default upload;
