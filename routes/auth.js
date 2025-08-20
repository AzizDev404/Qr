const express = require('express');
const {
  login,
  logout,
  checkAuthStatus,
  changePassword,
  getLoginStats,
  clearLoginAttempts,
  getAdminInfo
} = require('../controllers/authController');

const router = express.Router();

/**
 * Auth Routes
 * Base URL: /api/auth
 */

// POST /api/auth/login - Admin login
router.post('/login', login);

// POST /api/auth/logout - Admin logout
router.post('/logout', logout);

// GET /api/auth/status - Auth status check
router.get('/status', checkAuthStatus);

// POST /api/auth/change-password - Change admin password
router.post('/change-password', changePassword);

// GET /api/auth/login-stats - Login attempt statistics
router.get('/login-stats', getLoginStats);

// POST /api/auth/clear-attempts - Clear failed login attempts
router.post('/clear-attempts', clearLoginAttempts);

// GET /api/auth/admin-info - Get admin account info
router.get('/admin-info', getAdminInfo);

module.exports = router;