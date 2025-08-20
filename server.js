// server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Database connection
const { connectDB, closeDB } = require('./config/db');

// Middleware imports
const {
  globalErrorHandler,
  notFoundHandler,
  requestLogger,
  responseTimeLogger,
  handleDBConnection
} = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const qrRoutes = require('./routes/qr');
const scanRoutes = require('./routes/scan');

/**
 * Express App Setup
*/
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Security & Trust Proxy Settings
 */
app.set('trust proxy', true);

/**
 * Global Middleware
 */
if (NODE_ENV === 'development') {
  app.use(requestLogger);
  app.use(responseTimeLogger);
}

// CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    if (NODE_ENV === 'development') return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.BASE_URL,
      'http://localhost:5173',
      'https://docs-qr-offr.netlify.app'
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (filePath.includes('qrcodes')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    nodejs: process.version
  });
});

/**
 * API Info Endpoint
 */
app.get('/api', (req, res) => {
  res.json({
    name: 'Dynamic QR Code API',
    version: '1.0.0',
    description: 'QR code yaratish va dynamic content boshqarish API',
    endpoints: {
      auth: '/api/auth/*',
      qr_management: '/api/qr/*',
      public_scan: '/scan/:id',
      qr_info: '/api/scan-info/:id',
      qr_image: '/qr-image/:id'
    },
    documentation: `${process.env.BASE_URL}/docs`,
    support: 'support@yourdomain.com'
  });
});

/**
 * Routes Registration
 */
app.use('/api/auth', authRoutes);
app.use('/api/qr', qrRoutes);
app.use('/', scanRoutes);

/**
 * Frontend Static Files (ixtiyoriy)
 */
const frontendPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  // SPA fallback
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  console.log('📱 Frontend static files enabled');
}

/**
 * Root Route
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Dynamic QR Code System API',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: {
      admin_panel: '/admin',
      api_docs: '/api',
      health_check: '/health'
    }
  });
});

/**
 * Error Handling
 */
app.use(notFoundHandler);
app.use(globalErrorHandler);

/**
 * Database Connection va Server Start
 */
const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ Database connected successfully');

    handleDBConnection();

    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server started at ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
      console.log(`🏠 Environment: ${NODE_ENV}`);
      console.log('═════════════════════════════════\n');
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 ${signal} received. Shutting down...`);
      server.close(async () => {
        try {
          await closeDB();
          console.log('✅ Database connection closed');
          process.exit(0);
        } catch (err) {
          console.error('❌ Shutdown error:', err);
          process.exit(1);
        }
      });
      setTimeout(() => {
        console.error('⚠️ Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
