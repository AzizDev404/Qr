const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Fayl turini aniqlash va tegishli papkaga joylashtirish
 */
const getDestinationFolder = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audios';
  if (mimeType === 'application/pdf') return 'pdfs';
  if (mimeType.includes('document') || 
      mimeType.includes('sheet') || 
      mimeType.includes('presentation') ||
      mimeType.includes('text/')) return 'documents';
  return 'others';
};

/**
 * Xavfli fayl turlarini tekshirish
 */
const isDangerousFile = (filename, mimeType) => {
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.scr', '.pif', '.msi', '.com',
    '.scf', '.lnk', '.inf', '.reg', '.ps1', '.vbs', '.js'
  ];
  
  const dangerousMimeTypes = [
    'application/x-msdownload',
    'application/x-executable',
    'application/x-winexe',
    'application/x-msdos-program'
  ];
  
  const ext = path.extname(filename).toLowerCase();
  
  return dangerousExtensions.includes(ext) || 
         dangerousMimeTypes.includes(mimeType);
};

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const folder = getDestinationFolder(file.mimetype);
      const dir = path.join(__dirname, '..', 'uploads', 'dynamic-files', folder);
      
      // Papka mavjud emasligini tekshirish va yaratish
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Papka yaratildi: ${dir}`);
      }
      
      cb(null, dir);
      
    } catch (error) {
      console.error('❌ Destination error:', error);
      cb(error, null);
    }
  },
  
  filename: (req, file, cb) => {
    try {
      // Unique filename yaratish
      const timestamp = Date.now();
      const randomString = Math.round(Math.random() * 1e9).toString(36);
      const extension = path.extname(file.originalname);
      const sanitizedName = file.originalname
        .replace(extension, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50); // Max 50 character
      
      const uniqueName = `${timestamp}_${randomString}_${sanitizedName}${extension}`;
      
      cb(null, uniqueName);
      
    } catch (error) {
      console.error('❌ Filename error:', error);
      cb(error, null);
    }
  }
});

/**
 * File filter - xavfli fayllarni bloklash
 */
const fileFilter = (req, file, cb) => {
  try {
    // Fayl hajmini tekshirish (multer limits bilan ham qo'shimcha check)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 104857600; // 100MB
    
    // MIME type tekshirish
    if (!file.mimetype) {
      return cb(new Error('Fayl turi aniqlanmadi!'), false);
    }
    
    // Xavfli fayl tekshirish
    if (isDangerousFile(file.originalname, file.mimetype)) {
      return cb(new Error('Bu fayl turi xavfli va qabul qilinmaydi!'), false);
    }
    
    // Fayl nomi uzunligini tekshirish
    if (file.originalname.length > 255) {
      return cb(new Error('Fayl nomi juda uzun!'), false);
    }
    
    // Ruxsat berilgan fayl turlari (env dan)
    const allowedTypes = process.env.ALLOWED_FILE_TYPES;
    if (allowedTypes) {
      const typesList = allowedTypes.split(',');
      const isAllowed = typesList.some(type => {
        if (type.includes('*')) {
          // Wildcard pattern (image/*, video/*)
          const baseType = type.replace('*', '');
          return file.mimetype.startsWith(baseType);
        } else {
          return file.mimetype === type.trim();
        }
      });
      
      if (!isAllowed) {
        return cb(new Error(`Bu fayl turi ruxsat berilmagan: ${file.mimetype}`), false);
      }
    }
    
    console.log(`✅ Fayl qabul qilindi: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
    
  } catch (error) {
    console.error('❌ File filter error:', error);
    cb(error, false);
  }
};

/**
 * Multer configuration
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
    files: 1, // Bitta fayl (dynamic QR uchun)
    fields: 20, // Form fieldlarining soni
    fieldNameSize: 100, // Field name max uzunligi
    fieldSize: 1024 * 1024 // Field value max size (1MB)
  }
});

/**
 * Error handling middleware
 */
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        const maxSizeMB = Math.round((parseInt(process.env.MAX_FILE_SIZE) || 104857600) / 1024 / 1024);
        return res.status(400).json({
          success: false,
          error: `Fayl hajmi juda katta! Maksimal: ${maxSizeMB}MB`
        });
        
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Juda ko\'p fayl yuklandi!'
        });
        
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Juda ko\'p form field!'
        });
        
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Kutilmagan fayl field!'
        });
        
      default:
        return res.status(400).json({
          success: false,
          error: `Upload xatoligi: ${error.message}`
        });
    }
  }
  
  // Boshqa xatoliklar
  if (error) {
    console.error('❌ Upload error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Fayl yuklashda xatolik'
    });
  }
  
  next();
};

/**
 * Eski faylni o'chirish utility
 */
const deleteFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Fayl o'chirildi: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Fayl o\'chirishda xatolik:', error);
    return false;
  }
};

/**
 * Fayl ma'lumotlarini olish
 */
const getFileInfo = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exists: true
    };
  } catch (error) {
    console.error('❌ Fayl info xatoligi:', error);
    return null;
  }
};

module.exports = {
  upload,
  handleUploadError,
  deleteFile,
  getFileInfo,
  getDestinationFolder,
  isDangerousFile
};