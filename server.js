const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { fileURLToPath } = require("url");


// __dirname olish (ESM bo‘lsa shart)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// uploads papkasini static qilamiz
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


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
// Reverse proxy uchun (Nginx, Cloudflare)
app.set('trust proxy', true);

/**
 * Global Middleware
 */

// Request logging (development only)
if (NODE_ENV === 'development') {
  app.use(requestLogger);
  app.use(responseTimeLogger);
}

// CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    const env = process.env.NODE_ENV;

    if (env === 'development') {
      return callback(null, true);
    }

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
app.options('*', cors(corsOptions)); // 🔥 OPTIONS method uchun kerak

// Body parser middleware
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Static file serving
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d', // 1 kun cache
  setHeaders: (res, filePath) => {
    // Security headers for file serving
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // QR code rasmlar uchun cache
    if (filePath.includes('qrcodes')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 soat
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
    documentation: process.env.BASE_URL + '/docs', // Keyinchalik docs qo'shish mumkin
    support: 'support@yourdomain.com'
  });
});

/**
 * Routes Registration
 */

// Auth routes
app.use('/api/auth', authRoutes);

// QR management routes (admin)
app.use('/api/qr', qrRoutes);

// Public scan routes (mount directly to root)
app.use('/', scanRoutes);

/**
 * Frontend Static Files (ixtiyoriy)
 * Agar frontend build qilgan bo'lsangiz
 */
const frontendPath = path.join(__dirname, 'frontend', 'dist');
if (require('fs').existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  
  // SPA fallback - barcha route larni index.html ga yo'naltirish
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
      admin_panel: process.env.BASE_URL + '/admin',
      api_docs: process.env.BASE_URL + '/api',
      health_check: process.env.BASE_URL + '/health'
    }
  });
});

/**
 * Error Handling
 */

// 404 handler (404 ni hamma route lardan keyin qo'yish kerak)
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

/**
 * Database Connection va Server Start
 */
const startServer = async () => {
  try {
    // Database ga ulanish
    await connectDB();
    console.log('✅ Database connected successfully');
    
    // Database connection events
    handleDBConnection();
    
    // Server ni start qilish
    const server = app.listen(PORT, () => {
      console.log('\n🚀 Dynamic QR Code Server Started');
      console.log('═══════════════════════════════════');
      console.log(`🌐 Server URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
      console.log(`🏠 Environment: ${NODE_ENV}`);
      console.log(`📊 Admin Panel: ${process.env.BASE_URL || `http://localhost:${PORT}`}/admin`);
      console.log(`📱 Scan URL Pattern: ${process.env.BASE_URL || `http://localhost:${PORT}`}/scan/:id`);
      console.log(`👤 Admin User: ${process.env.ADMIN_USERNAME}`);
      console.log(`🔑 Admin Pass: ${process.env.ADMIN_PASSWORD}`);
      console.log('═══════════════════════════════════\n');
      
      if (NODE_ENV === 'development') {
        console.log('🔧 Development mode - detailed logging enabled');
        console.log(`📋 API Docs: ${process.env.BASE_URL || `http://localhost:${PORT}`}/api`);
        console.log(`💊 Health Check: ${process.env.BASE_URL || `http://localhost:${PORT}`}/health\n`);
      }
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
      
      server.close(async () => {
        console.log('🔒 HTTP server closed');
        
        try {
          await closeDB();
          console.log('✅ Database connection closed');
          console.log('👋 Server shutdown complete');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Forced shutdown after 10 seconds');
        process.exit(1);
      }, 10000);
    };
    
    // Signal handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Promise Rejection:', reason);
      console.error('Promise:', promise);
      // Server ni crash qilmaslik, lekin log qilish
    });
    
    // Uncaught exception
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      // Critical error - server ni restart qilish kerak
      process.exit(1);
    });
    }
    catch (error) {
      console.error('❌ Database connection error:', error);
      process.exit(1);
    }
  };

// Start the server
startServer();

module.exports = app;