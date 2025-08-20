const { catchAsync, createAppError, validateRequiredFields } = require('../middleware/errorHandler');

/**
 * Auth Controller - Login/Logout va session management
 * Sodda username/password based auth (keyinchalik JWT qo'shish mumkin)
 */

/**
 * Login attempt tracking (simple in-memory store)
 * Production da Redis yoki database ishlatish kerak
 */
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 daqiqa

/**
 * Rate limiting uchun helper function
 */
const checkRateLimit = (identifier) => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: now };
  
  // Lockout time tugaganini tekshirish
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeSinceLastAttempt = now - attempts.lastAttempt;
    if (timeSinceLastAttempt < LOCKOUT_TIME) {
      const remainingTime = Math.ceil((LOCKOUT_TIME - timeSinceLastAttempt) / 1000 / 60);
      throw createAppError(
        `Juda ko'p noto'g'ri urinish. ${remainingTime} daqiqadan keyin qayta urining.`,
        429
      );
    } else {
      // Lockout time tugagan, reset qilish
      loginAttempts.delete(identifier);
    }
  }
  
  return attempts;
};

/**
 * Login attempt ni record qilish
 */
const recordLoginAttempt = (identifier, success) => {
  const now = Date.now();
  
  if (success) {
    // Muvaffaqiyatli login - attempts ni tozalash
    loginAttempts.delete(identifier);
  } else {
    // Muvaffaqiyatsiz login - count ni oshirish
    const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: now };
    attempts.count += 1;
    attempts.lastAttempt = now;
    loginAttempts.set(identifier, attempts);
  }
};

/**
 * Environment variables ni validate qilish
 */
const validateEnvCredentials = () => {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw createAppError(
      'Server konfiguratsiyasida xatolik: Admin credentials o\'rnatilmagan',
      500
    );
  }
  
  // Weak password detection
  if (ADMIN_PASSWORD.length < 6) {
    console.warn('⚠️ Warning: Admin password juda oddiy!');
  }
  
  return { ADMIN_USERNAME, ADMIN_PASSWORD };
};

/**
 * Input validation
 */
const validateLoginInput = (username, password) => {
  if (!username || !password) {
    throw createAppError('Username va password majburiy!', 400);
  }
  
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw createAppError('Username va password string bo\'lishi kerak!', 400);
  }
  
  if (username.length > 100 || password.length > 200) {
    throw createAppError('Username yoki password juda uzun!', 400);
  }
  
  // Basic sanitization
  const sanitizedUsername = username.trim().toLowerCase();
  const sanitizedPassword = password.trim();
  
  return { sanitizedUsername, sanitizedPassword };
};

/**
 * LOGIN Controller
 */
const login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  
  // Input validation
  const { sanitizedUsername, sanitizedPassword } = validateLoginInput(username, password);
  
  // Rate limiting check
  const clientIdentifier = req.ip || 'unknown';
  checkRateLimit(clientIdentifier);
  
  // Environment credentials
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = validateEnvCredentials();
  
  // Credentials check
  const isValidUsername = sanitizedUsername === ADMIN_USERNAME.toLowerCase();
  const isValidPassword = sanitizedPassword === ADMIN_PASSWORD;
  const isAuthenticated = isValidUsername && isValidPassword;
  
  // Login attempt ni record qilish
  recordLoginAttempt(clientIdentifier, isAuthenticated);
  
  if (!isAuthenticated) {
    // Security: Generic error message
    throw createAppError('Noto\'g\'ri username yoki password', 401);
  }
  
  // Success response
  console.log(`✅ Muvaffaqiyatli login: ${sanitizedUsername} - IP: ${req.ip}`);
  
  // Simple session management (production da JWT ishlatish kerak)
  req.session = req.session || {};
  req.session.isAuthenticated = true;
  req.session.username = sanitizedUsername;
  req.session.loginTime = new Date();
  
  res.json({
    success: true,
    message: 'Muvaffaqiyatli login',
    user: {
      username: sanitizedUsername,
      loginTime: req.session.loginTime,
      role: 'admin'
    },
    // Session info (ixtiyoriy)
    sessionId: req.sessionID || 'simple-session'
  });
});

/**
 * LOGOUT Controller
 */
const logout = catchAsync(async (req, res, next) => {
  console.log(`👋 Logout: ${req.session?.username || 'Unknown'} - IP: ${req.ip}`);
  
  // Session ni tozalash
  if (req.session) {
    req.session.isAuthenticated = false;
    req.session.username = null;
    req.session.loginTime = null;
  }
  
  res.json({
    success: true,
    message: 'Muvaffaqiyatli logout',
    timestamp: new Date()
  });
});

/**
 * Check Auth Status
 */
const checkAuthStatus = catchAsync(async (req, res, next) => {
  const isAuthenticated = req.session?.isAuthenticated || false;
  
  if (isAuthenticated) {
    res.json({
      success: true,
      authenticated: true,
      user: {
        username: req.session.username,
        loginTime: req.session.loginTime,
        role: 'admin'
      }
    });
  } else {
    res.json({
      success: true,
      authenticated: false,
      message: 'Session mavjud emas'
    });
  }
});

/**
 * Change Password (ixtiyoriy feature)
 */
const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  // Validation
  validateRequiredFields(['currentPassword', 'newPassword', 'confirmPassword'], req);
  
  if (newPassword !== confirmPassword) {
    throw createAppError('Yangi parollar mos kelmaydi!', 400);
  }
  
  if (newPassword.length < 6) {
    throw createAppError('Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak!', 400);
  }
  
  // Current password check
  const { ADMIN_PASSWORD } = validateEnvCredentials();
  if (currentPassword !== ADMIN_PASSWORD) {
    throw createAppError('Joriy parol noto\'g\'ri!', 401);
  }
  
  // Note: Bu faqat demo uchun. Production da parolni hash qilish 
  // va .env faylini update qilish murakkab jarayon
  console.log('⚠️ Password change request - manual .env update required');
  
  res.json({
    success: true,
    message: 'Parol o\'zgartirish so\'rovi qabul qilindi. Admin tomonidan manual update qilinadi.',
    note: 'Production da avtomatik parol o\'zgartirish implementatsiya qilish kerak'
  });
});

/**
 * Get Login Statistics (admin uchun)
 */
const getLoginStats = catchAsync(async (req, res, next) => {
  const stats = {
    totalFailedAttempts: Array.from(loginAttempts.values())
      .reduce((sum, attempt) => sum + attempt.count, 0),
    currentlyLocked: Array.from(loginAttempts.values())
      .filter(attempt => {
        const now = Date.now();
        const timeSinceLastAttempt = now - attempt.lastAttempt;
        return attempt.count >= MAX_LOGIN_ATTEMPTS && timeSinceLastAttempt < LOCKOUT_TIME;
      }).length,
    lockoutSettings: {
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      lockoutTimeMinutes: LOCKOUT_TIME / 1000 / 60
    }
  };
  
  res.json({
    success: true,
    loginStats: stats
  });
});

/**
 * Clear Login Attempts (admin uchun)
 */
const clearLoginAttempts = catchAsync(async (req, res, next) => {
  const previousSize = loginAttempts.size;
  loginAttempts.clear();
  
  console.log(`🧹 Login attempts tozalandi: ${previousSize} ta record`);
  
  res.json({
    success: true,
    message: `${previousSize} ta login attempt record tozalandi`,
    clearedCount: previousSize
  });
});

/**
 * Demo Admin Account Info
 */
const getAdminInfo = catchAsync(async (req, res, next) => {
  const { ADMIN_USERNAME } = validateEnvCredentials();
  
  res.json({
    success: true,
    adminInfo: {
      username: ADMIN_USERNAME,
      role: 'admin',
      permissions: [
        'qr_create',
        'qr_update', 
        'qr_delete',
        'qr_view_stats',
        'system_admin'
      ],
      sessionInfo: req.session || null
    }
  });
});

module.exports = {
  login,
  logout,
  checkAuthStatus,
  changePassword,
  getLoginStats,
  clearLoginAttempts,
  getAdminInfo
};