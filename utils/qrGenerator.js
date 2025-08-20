const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * QR Code generation utility
 * Dynamic QR lar uchun maxsus sozlangan
 */

/**
 * QR code papkasini yaratish
 */
const ensureQRDirectory = () => {
  const qrDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
    console.log(`📁 QR codes papkasi yaratildi: ${qrDir}`);
  }
  return qrDir;
};

/**
 * QR Code uchun scan URL yaratish
 */
const createScanUrl = (qrId) => {
  const baseUrl = process.env.BASE_URL;
  return `${baseUrl}/scan/${qrId}`;
};

/**
 * QR Code options - default settings
 */
const getQROptions = (customOptions = {}) => {
  return {
    width: parseInt(process.env.QR_SIZE) || 400,
    margin: parseInt(process.env.QR_MARGIN) || 2,
    color: {
      dark: '#0016d8ff',    // QR code rangi
      light: '#FFFFFF'    // Orqa fon rangi
    },
    errorCorrectionLevel: 'M', // L, M, Q, H (M = Medium)
    type: 'png',
    quality: 0.92,
    ...customOptions // Custom options ni merge qilish
  };
};

/**
 * Asosiy QR Code yaratish funktsiyasi
 */
const generateQRCode = async (qrId, customOptions = {}) => {
  try {
    // QR directory ni tekshirish
    const qrDir = ensureQRDirectory();
    
    // Scan URL yaratish
    const scanUrl = createScanUrl(qrId);
    
    // QR fayl yo'li
    const qrFileName = `dynamic_qr_${qrId}.png`;
    const qrPath = path.join(qrDir, qrFileName);
    
    // QR options
    const options = getQROptions(customOptions);
    
    console.log(`🎯 QR yaratilmoqda: ${qrId}`);
    console.log(`🔗 Scan URL: ${scanUrl}`);
    
    // QR code ni faylga saqlash
    await QRCode.toFile(qrPath, scanUrl, options);
    
    console.log(`✅ QR yaratildi: ${qrPath}`);
    
    return {
      qrPath,
      qrFileName,
      scanUrl,
      qrDir,
      size: options.width
    };
    
  } catch (error) {
    console.error('❌ QR yaratishda xatolik:', error);
    throw new Error(`QR code yaratib bo'lmadi: ${error.message}`);
  }
};

/**
 * QR Code ni buffer sifatida olish (API response uchun)
 */
const generateQRBuffer = async (qrId, format = 'png', customOptions = {}) => {
  try {
    const scanUrl = createScanUrl(qrId);
    const options = getQROptions(customOptions);
    
    console.log(`🎯 QR buffer yaratilmoqda: ${qrId} (${format})`);
    
    let buffer;
    
    if (format === 'svg') {
      buffer = await QRCode.toString(scanUrl, { type: 'svg', ...options });
    } else {
      buffer = await QRCode.toBuffer(scanUrl, { type: format, ...options });
    }
    
    return {
      buffer,
      mimeType: format === 'svg' ? 'image/svg+xml' : `image/${format}`,
      scanUrl
    };
    
  } catch (error) {
    console.error('❌ QR buffer yaratishda xatolik:', error);
    throw new Error(`QR buffer yaratib bo'lmadi: ${error.message}`);
  }
};

/**
 * Custom styled QR Code yaratish
 */
const generateStyledQR = async (qrId, style = 'default') => {
  const styles = {
    default: {
      color: { dark: '#000000', light: '#FFFFFF' }
    },
    blue: {
      color: { dark: '#1a73e8', light: '#FFFFFF' }
    },
    green: {
      color: { dark: '#34a853', light: '#FFFFFF' }
    },
    red: {
      color: { dark: '#ea4335', light: '#FFFFFF' }
    },
    purple: {
      color: { dark: '#9c27b0', light: '#FFFFFF' }
    },
    gradient: {
      // Gradient qo'llab-quvvatlanmaydi, eng yaqin rangni ishlatamiz
      color: { dark: '#667eea', light: '#FFFFFF' }
    }
  };
  
  const styleOptions = styles[style] || styles.default;
  return await generateQRCode(qrId, styleOptions);
};

/**
 * QR Code mavjudligini tekshirish
 */
const qrExists = (qrId) => {
  try {
    const qrDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    const qrPath = path.join(qrDir, `dynamic_qr_${qrId}.png`);
    return fs.existsSync(qrPath);
  } catch (error) {
    return false;
  }
};

/**
 * QR Code ni o'chirish
 */
const deleteQRCode = (qrId) => {
  try {
    const qrDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    const qrPath = path.join(qrDir, `dynamic_qr_${qrId}.png`);
    
    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
      console.log(`🗑️ QR o'chirildi: ${qrPath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ QR o\'chirishda xatolik:', error);
    return false;
  }
};

/**
 * QR Code fayl ma'lumotlarini olish
 */
const getQRInfo = (qrId) => {
  try {
    const qrDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    const qrPath = path.join(qrDir, `dynamic_qr_${qrId}.png`);
    
    if (!fs.existsSync(qrPath)) {
      return null;
    }
    
    const stats = fs.statSync(qrPath);
    const baseUrl = process.env.BASE_URL;
    
    return {
      qrId,
      fileName: `dynamic_qr_${qrId}.png`,
      filePath: qrPath,
      fileSize: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      scanUrl: createScanUrl(qrId),
      imageUrl: `${baseUrl}/uploads/qrcodes/dynamic_qr_${qrId}.png`,
      exists: true
    };
    
  } catch (error) {
    console.error('❌ QR info olishda xatolik:', error);
    return null;
  }
};

/**
 * Batch QR generation - bir nechta QR ni bir vaqtda yaratish
 */
const generateMultipleQRs = async (qrIds, customOptions = {}) => {
  try {
    console.log(`🎯 Batch QR yaratish: ${qrIds.length} ta`);
    
    const results = await Promise.allSettled(
      qrIds.map(qrId => generateQRCode(qrId, customOptions))
    );
    
    const successful = [];
    const failed = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push({
          qrId: qrIds[index],
          ...result.value
        });
      } else {
        failed.push({
          qrId: qrIds[index],
          error: result.reason.message
        });
      }
    });
    
    console.log(`✅ Muvaffaqiyatli: ${successful.length}, ❌ Xato: ${failed.length}`);
    
    return { successful, failed };
    
  } catch (error) {
    console.error('❌ Batch QR yaratishda xatolik:', error);
    throw error;
  }
};

/**
 * QR Code o'lchamini o'zgartirish
 */
const resizeQR = async (qrId, newSize) => {
  try {
    if (newSize < 100 || newSize > 2000) {
      throw new Error('QR o\'lchami 100-2000 px orasida bo\'lishi kerak');
    }
    
    return await generateQRCode(qrId, { width: newSize });
    
  } catch (error) {
    console.error('❌ QR resize xatoligi:', error);
    throw error;
  }
};

/**
 * QR Code validation
 */
const validateQRData = (data) => {
  // QR Code maksimal ma'lumot hajmi
  const maxDataLength = 2953; // Alphanumeric uchun
  
  if (!data) {
    throw new Error('QR data bo\'sh bo\'lishi mumkin emas');
  }
  
  if (typeof data !== 'string') {
    throw new Error('QR data string bo\'lishi kerak');
  }
  
  if (data.length > maxDataLength) {
    throw new Error(`QR data juda uzun: ${data.length}/${maxDataLength}`);
  }
  
  return true;
};

module.exports = {
  generateQRCode,
  generateQRBuffer,
  generateStyledQR,
  generateMultipleQRs,
  qrExists,
  deleteQRCode,
  getQRInfo,
  resizeQR,
  createScanUrl,
  validateQRData,
  getQROptions
};