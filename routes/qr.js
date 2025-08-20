const express = require('express');
const { upload, handleUploadError } = require('../middleware/upload');
const {
  createQR,
  updateQRContent,
  getAllQRs,
  getQRById,
  deleteQR,
  restoreQR,
  getQRStats,
  updateQRSettings,
  bulkDeleteQRs
} = require('../controllers/qrController');

const router = express.Router();

/**
 * QR Management Routes
 * Base URL: /api/qr
 * 
 * Note: Production da auth middleware qo'shish kerak
 * const authMiddleware = require('../middleware/auth');
 * router.use(authMiddleware); // Barcha route larga auth qo'shish
 */

// GET /api/qr/stats - QR system statistics
router.get('/stats', getQRStats);

// GET /api/qr - Get all QRs with pagination and filters
router.get('/', getAllQRs);

// POST /api/qr/create - Create new empty QR
router.post('/create', createQR);

// POST /api/qr/bulk-delete - Bulk delete QRs
router.post('/bulk-delete', bulkDeleteQRs);

// GET /api/qr/:id - Get specific QR details
router.get('/:id', getQRById);

// PUT /api/qr/:id/content - Update QR content (with file upload)
router.put('/:id/content', upload.single('file'), updateQRContent);

// PUT /api/qr/:id/settings - Update QR settings
router.put('/:id/settings', updateQRSettings);

// DELETE /api/qr/:id - Delete QR (soft delete by default)
router.delete('/:id', deleteQR);

// POST /api/qr/:id/restore - Restore deleted QR
router.post('/:id/restore', restoreQR);

// Error handler for file uploads
router.use(handleUploadError);

module.exports = router;