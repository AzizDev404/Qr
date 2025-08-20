const DynamicQR = require('../models/DynamicQR');
const { generateQRCode, deleteQRCode, getQRInfo } = require('../utils/qrGenerator');
const { deleteFile } = require('../middleware/upload');
const { catchAsync, createAppError, validateRequiredFields } = require('../middleware/errorHandler');

/**
 * QR Controller - Dynamic QR CRUD operations
 */

/**
 * Unique ID generator
 */
const generateUniqueId = () => {
  const timestamp = Date.now().toString();
  const randomString = Math.random().toString(36).slice(2, 11);
  return timestamp + randomString;
};

/**
 * Content type validation
 */
const validateContentType = (contentType) => {
  const allowedTypes = ['text', 'link', 'file', 'contact', 'empty'];
  if (!allowedTypes.includes(contentType)) {
    throw createAppError(
      `Noto'g'ri content type: ${contentType}. Ruxsat berilgan: ${allowedTypes.join(', ')}`,
      400
    );
  }
};

/**
 * URL validation
 */
const validateUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(urlObj.protocol)) {
      throw new Error('Faqat HTTP va HTTPS protokollari ruxsat berilgan');
    }
    return true;
  } catch (error) {
    throw createAppError(`Noto'g'ri URL: ${error.message}`, 400);
  }
};

/**
 * Email validation
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createAppError('Noto\'g\'ri email format', 400);
  }
};

/**
 * Phone validation
 */
const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{7,20}$/;
  if (!phoneRegex.test(phone)) {
    throw createAppError('Noto\'g\'ri telefon format', 400);
  }
};

/**
 * 1. YANGI QR YARATISH (bo'sh content bilan)
 */
const createQR = catchAsync(async (req, res, next) => {
  const { title, description } = req.body;
  
  // Validation
  validateRequiredFields(['title'], req);
  
  if (title.length > 200) {
    throw createAppError('QR title 200 belgidan oshmasligi kerak', 400);
  }
  
  // Unique ID generation
  let qrId;
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 5) {
    qrId = generateUniqueId();
    const existing = await DynamicQR.findOne({ id: qrId });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    throw createAppError('Unique ID yaratib bo\'lmadi. Qayta urining.', 500);
  }
  
  try {
    // QR Code yaratish
    const qrResult = await generateQRCode(qrId);
    
    // Database ga saqlash
    const newQR = new DynamicQR({
      id: qrId,
      title: title.trim(),
      qrCodePath: qrResult.qrPath,
      currentContent: {
        type: 'empty',
        description: description || 'Content hali qo\'shilmagan',
        lastUpdated: new Date()
      }
    });
    
    await newQR.save();
    
    console.log(`✅ Yangi QR yaratildi: ${qrId} - ${title}`);
    
    res.status(201).json({
      success: true,
      message: 'QR code muvaffaqiyatli yaratildi',
      qr: {
        id: qrId,
        title: newQR.title,
        scanUrl: newQR.scanUrl,
        qrImageUrl: newQR.qrImageUrl,
        currentContent: newQR.currentContent,
        createdDate: newQR.createdDate,
        scanCount: newQR.scanCount
      }
    });
    
  } catch (error) {
    // Agar database save failed bo'lsa, QR faylni o'chirish
    deleteQRCode(qrId);
    throw error;
  }
});

/**
 * 2. QR CONTENT NI YANGILASH
 */
const updateQRContent = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { contentType, text, url, linkTitle, contactName, phone, email, company, description } = req.body;
  
  // QR ni topish
  const qr = await DynamicQR.findOne({ id });
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  // Content type validation
  validateRequiredFields(['contentType'], req);
  validateContentType(contentType);
  
  // Eski content ni history ga qo'shish
  qr.addToHistory(qr.currentContent);
  
  // Eski file ni o'chirish (agar yangi file yuklansa)
  if (qr.currentContent.type === 'file' && qr.currentContent.filePath && req.file) {
    deleteFile(qr.currentContent.filePath);
  }
  
  // Yangi content ni prepare qilish
  const newContent = {
    type: contentType,
    description: description || '',
    lastUpdated: new Date()
  };
  
  // Content type ga qarab specific validation va data set qilish
  switch (contentType) {
    case 'text':
      if (!text || text.trim().length === 0) {
        throw createAppError('Text content bo\'sh bo\'lishi mumkin emas!', 400);
      }
      if (text.length > 5000) {
        throw createAppError('Text 5000 belgidan oshmasligi kerak!', 400);
      }
      newContent.text = text.trim();
      break;
      
    case 'link':
      if (!url || url.trim().length === 0) {
        throw createAppError('URL bo\'sh bo\'lishi mumkin emas!', 400);
      }
      validateUrl(url.trim());
      newContent.url = url.trim();
      newContent.linkTitle = linkTitle?.trim() || url.trim();
      break;
      
    case 'file':
      if (!req.file) {
        throw createAppError('Fayl yuklash majburiy!', 400);
      }
      newContent.fileName = req.file.filename;
      newContent.originalName = req.file.originalname;
      newContent.filePath = req.file.path;
      newContent.fileSize = req.file.size;
      newContent.mimeType = req.file.mimetype;
      break;
      
    case 'contact':
      if (!contactName && !phone && !email) {
        throw createAppError('Kamida bitta contact ma\'lumoti kerak!', 400);
      }
      if (contactName) newContent.contactName = contactName.trim();
      if (phone) {
        validatePhone(phone.trim());
        newContent.phone = phone.trim();
      }
      if (email) {
        validateEmail(email.trim());
        newContent.email = email.trim();
      }
      if (company) newContent.company = company.trim();
      break;
      
    case 'empty':
      newContent.description = 'Content o\'chirildi';
      break;
      
    default:
      throw createAppError('Noto\'g\'ri content turi!', 400);
  }
  
  // Content ni update qilish
  qr.currentContent = newContent;
  await qr.save();
  
  console.log(`🔄 QR content yangilandi: ${id} - ${contentType}`);
  
  res.json({
    success: true,
    message: 'Content muvaffaqiyatli yangilandi',
    qr: {
      id: qr.id,
      title: qr.title,
      currentContent: qr.currentContent,
      scanCount: qr.scanCount,
      lastUpdated: qr.currentContent.lastUpdated
    }
  });
});

/**
 * 3. BARCHA QR LAR RO'YXATI (pagination bilan)
 */
const getAllQRs = catchAsync(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const sortBy = req.query.sortBy || 'createdDate';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  const contentType = req.query.contentType;
  const search = req.query.search;
  
  const skip = (page - 1) * limit;
  
  // Filter object yaratish
  const filter = { isActive: true };
  
  if (contentType && contentType !== 'all') {
    validateContentType(contentType);
    filter['currentContent.type'] = contentType;
  }
  
  if (search && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { title: searchRegex },
      { 'currentContent.description': searchRegex }
    ];
  }
  
  // Sort object yaratish
  const allowedSortFields = ['createdDate', 'title', 'scanCount', 'lastScanned'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdDate';
  const sort = { [sortField]: sortOrder };
  
  try {
    const [qrs, total] = await Promise.all([
      DynamicQR.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-contentHistory'), // History ni response ga qo'shmaymiz
      DynamicQR.countDocuments(filter)
    ]);
    
    const qrsWithUrls = qrs.map(qr => ({
      id: qr.id,
      title: qr.title,
      currentContent: qr.currentContent,
      scanUrl: qr.scanUrl,
      qrImageUrl: qr.qrImageUrl,
      createdDate: qr.createdDate,
      scanCount: qr.scanCount,
      lastScanned: qr.lastScanned,
      isActive: qr.isActive
    }));
    
    res.json({
      success: true,
      qrs: qrsWithUrls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      filters: {
        contentType: contentType || 'all',
        search: search || '',
        sortBy: sortField,
        sortOrder: sortOrder === 1 ? 'asc' : 'desc'
      }
    });
    
  } catch (error) {
    throw createAppError(`QR list olishda xatolik: ${error.message}`, 500);
  }
});

/**
 * 4. BITTA QR HAQIDA BATAFSIL (history bilan)
 */
const getQRById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const includeHistory = req.query.includeHistory === 'true';
  
  const qr = await DynamicQR.findOne({ id, isActive: true });
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  const response = {
    id: qr.id,
    title: qr.title,
    currentContent: qr.currentContent,
    scanUrl: qr.scanUrl,
    qrImageUrl: qr.qrImageUrl,
    createdDate: qr.createdDate,
    scanCount: qr.scanCount,
    lastScanned: qr.lastScanned,
    isActive: qr.isActive,
    settings: qr.settings
  };
  
  // History ni faqat so'ralganda qo'shish
  if (includeHistory) {
    response.contentHistory = qr.contentHistory.slice(-10); // So'nggi 10 ta
  }
  
  res.json({
    success: true,
    qr: response
  });
});

/**
 * 5. QR O'CHIRISH (soft delete)
 */
const deleteQR = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const forceDelete = req.query.force === 'true';
  
  const qr = await DynamicQR.findOne({ id });
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  if (forceDelete) {
    // Hard delete - fayllarni ham o'chirish
    if (qr.currentContent.type === 'file' && qr.currentContent.filePath) {
      deleteFile(qr.currentContent.filePath);
    }
    
    deleteQRCode(qr.id);
    await DynamicQR.deleteOne({ id });
    
    console.log(`🗑️ QR hard delete: ${id}`);
    
    res.json({
      success: true,
      message: 'QR to\'liq o\'chirildi',
      deleted: true
    });
  } else {
    // Soft delete - faqat isActive = false
    qr.isActive = false;
    await qr.save();
    
    console.log(`🚫 QR soft delete: ${id}`);
    
    res.json({
      success: true,
      message: 'QR deaktivatsiya qilindi',
      deleted: false,
      note: 'QR code ishlashni to\'xtatdi, lekin ma\'lumotlar saqlanadi'
    });
  }
});

/**
 * 6. QR NI RESTORE QILISH
 */
const restoreQR = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const qr = await DynamicQR.findOne({ id, isActive: false });
  if (!qr) {
    throw createAppError('O\'chirilgan QR topilmadi', 404);
  }
  
  qr.isActive = true;
  await qr.save();
  
  console.log(`♻️ QR restored: ${id}`);
  
  res.json({
    success: true,
    message: 'QR muvaffaqiyatli qayta faollashtirildi',
    qr: {
      id: qr.id,
      title: qr.title,
      scanUrl: qr.scanUrl,
      isActive: qr.isActive
    }
  });
});

/**
 * 7. QR STATISTIKASI
 */
const getQRStats = catchAsync(async (req, res, next) => {
  try {
    const [
      totalQRs,
      activeQRs,
      inactiveQRs,
      totalScans,
      contentStats,
      recentQRs,
      popularQRs
    ] = await Promise.all([
      DynamicQR.countDocuments(),
      DynamicQR.countDocuments({ isActive: true }),
      DynamicQR.countDocuments({ isActive: false }),
      DynamicQR.aggregate([
        { $group: { _id: null, total: { $sum: '$scanCount' } } }
      ]),
      DynamicQR.getContentTypeStats(),
      DynamicQR.find({ isActive: true })
        .sort({ createdDate: -1 })
        .limit(5)
        .select('id title currentContent.type scanCount createdDate'),
      DynamicQR.getPopularQRs(5)
    ]);
    
    // Bugungi statistika
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const [todayQRs, todayScans] = await Promise.all([
      DynamicQR.countDocuments({
        createdDate: { $gte: todayStart },
        isActive: true
      }),
      DynamicQR.aggregate([
        { $match: { lastScanned: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ])
    ]);
    
    res.json({
      success: true,
      stats: {
        overview: {
          totalQRs,
          activeQRs,
          inactiveQRs,
          totalScans: totalScans[0]?.total || 0
        },
        today: {
          newQRs: todayQRs,
          scans: todayScans[0]?.total || 0
        },
        contentTypes: contentStats,
        recent: recentQRs,
        popular: popularQRs
      }
    });
    
  } catch (error) {
    throw createAppError(`Statistika olishda xatolik: ${error.message}`, 500);
  }
});

/**
 * 8. QR SETTINGS NI YANGILASH
 */
const updateQRSettings = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { allowTracking, customDomain, password } = req.body;
  
  const qr = await DynamicQR.findOne({ id, isActive: true });
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  // Settings update
  if (typeof allowTracking === 'boolean') {
    qr.settings.allowTracking = allowTracking;
  }
  
  if (customDomain !== undefined) {
    if (customDomain && typeof customDomain === 'string') {
      validateUrl(`https://${customDomain}`);
      qr.settings.customDomain = customDomain.trim();
    } else {
      qr.settings.customDomain = null;
    }
  }
  
  if (password !== undefined) {
    if (password && typeof password === 'string') {
      if (password.length < 4) {
        throw createAppError('Password kamida 4 ta belgidan iborat bo\'lishi kerak', 400);
      }
      qr.settings.password = password; // Production da hash qilish kerak
    } else {
      qr.settings.password = null;
    }
  }
  
  await qr.save();
  
  res.json({
    success: true,
    message: 'QR settings yangilandi',
    settings: qr.settings
  });
});

/**
 * 9. BULK OPERATIONS
 */
const bulkDeleteQRs = catchAsync(async (req, res, next) => {
  const { qrIds, forceDelete } = req.body;
  
  if (!Array.isArray(qrIds) || qrIds.length === 0) {
    throw createAppError('QR ID lari majburiy (array)', 400);
  }
  
  if (qrIds.length > 50) {
    throw createAppError('Bir vaqtda maksimal 50 ta QR o\'chirish mumkin', 400);
  }
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const qrId of qrIds) {
    try {
      const qr = await DynamicQR.findOne({ id: qrId });
      if (!qr) {
        results.failed.push({ id: qrId, error: 'QR topilmadi' });
        continue;
      }
      
      if (forceDelete) {
        if (qr.currentContent.type === 'file' && qr.currentContent.filePath) {
          deleteFile(qr.currentContent.filePath);
        }
        deleteQRCode(qr.id);
        await DynamicQR.deleteOne({ id: qrId });
      } else {
        qr.isActive = false;
        await qr.save();
      }
      
      results.success.push({ id: qrId, title: qr.title });
    } catch (error) {
      results.failed.push({ id: qrId, error: error.message });
    }
  }
  
  console.log(`🗑️ Bulk delete: ${results.success.length} success, ${results.failed.length} failed`);
  
  res.json({
    success: true,
    message: `${results.success.length} ta QR o'chirildi`,
    results
  });
});

module.exports = {
  createQR,
  updateQRContent,
  getAllQRs,
  getQRById,
  deleteQR,
  restoreQR,
  getQRStats,
  updateQRSettings,
  bulkDeleteQRs
};