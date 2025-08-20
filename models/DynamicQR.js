const mongoose = require('mongoose');

/**
 * Content History Schema - har bir o'zgarishni saqlash uchun
 */
const contentHistorySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['text', 'link', 'file', 'contact', 'empty']
  },
  content: {
    type: mongoose.Schema.Types.Mixed, // Har qanday data type
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  changedBy: {
    type: String,
    default: 'admin' // Keyinchalik user system qo'shsak
  }
}, { _id: true });

/**
 * Current Content Schema - hozirgi aktiv content
 */
const currentContentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['text', 'link', 'file', 'contact', 'empty'],
    default: 'empty'
  },
  
  // TEXT content fields
  text: {
    type: String,
    maxlength: 5000 // 5000 ta belgi limit
  },
  
  // LINK content fields
  url: {
    type: String,
    validate: {
      validator: function(v) {
        // URL validation faqat link type da
        if (this.type === 'link') {
          return /^https?:\/\/.+/.test(v);
        }
        return true;
      },
      message: 'Noto\'g\'ri URL format!'
    }
  },
  linkTitle: {
    type: String,
    maxlength: 200
  },
  
  // FILE content fields
  fileName: String,        // Server dagi fayl nomi
  originalName: String,    // Asl fayl nomi
  filePath: String,        // To'liq fayl yo'li
  fileSize: {
    type: Number,
    min: 0
  },
  mimeType: String,        // Fayl turi
  
  // CONTACT content fields
  contactName: {
    type: String,
    maxlength: 100
  },
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        // Phone validation faqat contact type da
        if (this.type === 'contact' && v) {
          return /^\+?[\d\s\-\(\)]{7,20}$/.test(v);
        }
        return true;
      },
      message: 'Noto\'g\'ri telefon format!'
    }
  },
  email: {
    type: String,
    validate: {
      validator: function(v) {
        // Email validation faqat contact type da
        if (this.type === 'contact' && v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        }
        return true;
      },
      message: 'Noto\'g\'ri email format!'
    }
  },
  company: {
    type: String,
    maxlength: 200
  },
  
  // Umumiy fields
  description: {
    type: String,
    maxlength: 1000
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Asosiy Dynamic QR Schema
 */
const dynamicQRSchema = new mongoose.Schema({
  // Unique identifier
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // QR Basic Info
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  qrCodePath: {
    type: String,
    required: true
  },
  
  // Dynamic Content
  currentContent: {
    type: currentContentSchema,
    required: true,
    default: () => ({
      type: 'empty',
      description: 'Content hali qo\'shilmagan',
      lastUpdated: new Date()
    })
  },
  
  // Timestamps
  createdDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Statistics
  scanCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastScanned: {
    type: Date,
    index: true
  },
  
  // Content History
  contentHistory: {
    type: [contentHistorySchema],
    default: [],
    // Faqat so'nggi 50 ta o'zgarishni saqlash
    validate: {
      validator: function(v) {
        return v.length <= 50;
      },
      message: 'Content history juda ko\'p!'
    }
  },
  
  // Additional Settings
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  settings: {
    allowTracking: {
      type: Boolean,
      default: true
    },
    customDomain: String, // Keyinchalik custom domain uchun
    password: String      // Password protected QR uchun
  }
}, {
  timestamps: true, // createdAt va updatedAt avtomatik qo'shiladi
  versionKey: false // __v field ni o'chirish
});

// Indexes for better performance
dynamicQRSchema.index({ createdDate: -1 });
dynamicQRSchema.index({ scanCount: -1 });
dynamicQRSchema.index({ 'currentContent.type': 1 });
dynamicQRSchema.index({ isActive: 1, createdDate: -1 });

// Pre-save middleware - content history ni tozalash
dynamicQRSchema.pre('save', function(next) {
  // Agar content history 50 dan ko'p bo'lsa, eskilarini o'chirish
  if (this.contentHistory.length > 50) {
    this.contentHistory = this.contentHistory.slice(-50);
  }
  next();
});

// Instance methods
dynamicQRSchema.methods.addToHistory = function(oldContent) {
  this.contentHistory.push({
    type: oldContent.type,
    content: oldContent.toObject(),
    changedAt: new Date()
  });
};

dynamicQRSchema.methods.incrementScan = function() {
  this.scanCount += 1;
  this.lastScanned = new Date();
  return this.save();
};

// Static methods
dynamicQRSchema.statics.getActiveQRs = function() {
  return this.find({ isActive: true }).sort({ createdDate: -1 });
};

dynamicQRSchema.statics.getPopularQRs = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ scanCount: -1 })
    .limit(limit);
};

dynamicQRSchema.statics.getContentTypeStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { $group: { 
      _id: '$currentContent.type', 
      count: { $sum: 1 },
      totalScans: { $sum: '$scanCount' }
    }},
    { $sort: { count: -1 } }
  ]);
};

// Virtual for scan URL
dynamicQRSchema.virtual('scanUrl').get(function() {
  const baseUrl = process.env.BASE_URL;
  return `${baseUrl}/scan/${this.id}`;
});

// Virtual for QR image URL
dynamicQRSchema.virtual('qrImageUrl').get(function() {
  const baseUrl = process.env.BASE_URL
  return `${baseUrl}/uploads/qrcodes/dynamic_qr_${this.id}.png`;
});

// JSON transform - sensitive ma'lumotlarni yashirish
dynamicQRSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    // Content history ni limit qilish (faqat admin uchun to'liq ko'rsatish)
    if (ret.contentHistory && ret.contentHistory.length > 5) {
      ret.contentHistory = ret.contentHistory.slice(-5);
    }
    return ret;
  }
});

const DynamicQR = mongoose.model('DynamicQR', dynamicQRSchema);

module.exports = DynamicQR;