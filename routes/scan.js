const express = require('express');
const {
  scanQR,
  getQRScanInfo,
  previewQR,
  getScanStats,
  quickRedirect,
  serveQRImage,
  handleCustomDomain,
  handle404
} = require('../controllers/scanController');

const router = express.Router();

/**
 * Public Scan Routes
 * Bu route lar hech qanday auth talab qilmaydi
 */

// GET /scan/:id - Main QR scan endpoint (public)
router.get('/scan/:id', scanQR);

// GET /r/:id - Quick redirect (short URL)
router.get('/r/:id', quickRedirect);

// GET /preview/:id - QR preview without incrementing scan count
router.get('/preview/:id', previewQR);

// GET /qr-image/:id - Serve QR code image
router.get('/qr-image/:id', serveQRImage);

// API endpoints for QR info (public)
// GET /api/scan-info/:id - Get QR scan information
router.get('/api/scan-info/:id', getQRScanInfo);

// GET /api/scan-stats/:id - Get QR scan statistics
router.get('/api/scan-stats/:id', getScanStats);

// Custom domain handler (ixtiyoriy)
// GET /custom/:subdomain - Handle custom domain requests
router.get('/custom/:subdomain', handleCustomDomain);

module.exports = router;