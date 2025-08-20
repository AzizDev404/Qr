const DynamicQR = require('../models/DynamicQR');
const { catchAsync, createAppError } = require('../middleware/errorHandler');
const fs = require('fs');
const path = require('path');

/**
 * Scan Controller - QR code scan qilganda ishlaydigan public endpoints
 */

/**
 * User Agent detection uchun helper
 */
const detectDevice = (userAgent) => {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  } else {
    return 'desktop';
  }
};

/**
 * Scan analytics ma'lumotlarini saqlash
 */
const recordScanAnalytics = async (qr, req) => {
  try {
    if (!qr.settings?.allowTracking) {
      return; // Tracking o'chirilgan bo'lsa, analytics saqlamaymiz
    }
    
    const analytics = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      device: detectDevice(req.get('User-Agent') || ''),
      referer: req.get('Referer'),
      timestamp: new Date(),
      country: req.get('CF-IPCountry') || 'unknown', // Cloudflare header
    };
    
    // Simple analytics - production da alohida collection ishlatish kerak
    console.log(`📊 Scan analytics: ${qr.id}`, analytics);
    
  } catch (error) {
    console.error('❌ Analytics error:', error);
    // Analytics xatoligi asosiy flow ni buzmasligi kerak
  }
};

/**
 * Password protected QR uchun password check
 */
const checkQRPassword = (qr, providedPassword) => {
  if (!qr.settings?.password) {
    return true; // Password yo'q
  }
  
  return qr.settings.password === providedPassword; // Production da hash comparison
};

/**
 * HTML response template
 */
const generateHTMLResponse = (title, content, styles = '', scripts = '') => {
  return `
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #333; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container { 
            background: white; 
            padding: 2rem; 
            border-radius: 15px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 600px; 
            width: 100%;
            text-align: center;
        }
        .qr-title { 
            color: #4a5568; 
            margin-bottom: 1rem; 
            font-size: 1.5rem;
            font-weight: 600;
        }
        .content { 
            margin: 1.5rem 0; 
        }
        .text-content {
            background: #f7fafc;
            padding: 1.5rem;
            border-radius: 10px;
            border-left: 4px solid #667eea;
            text-align: left;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .stats { 
            margin-top: 2rem; 
            padding-top: 1rem; 
            border-top: 1px solid #e2e8f0; 
            font-size: 0.875rem; 
            color: #718096;
        }
        .contact-card {
            background: #f7fafc;
            padding: 1.5rem;
            border-radius: 10px;
            text-align: left;
        }
        .contact-field {
            margin: 0.5rem 0;
            padding: 0.5rem;
            background: white;
            border-radius: 5px;
        }
        .error { color: #e53e3e; }
        .success { color: #38a169; }
        .button {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            transition: background 0.3s;
        }
        .button:hover { background: #5a67d8; }
        .password-form {
            background: #f7fafc;
            padding: 1.5rem;
            border-radius: 10px;
            margin: 1rem 0;
        }
        .password-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            margin: 10px 0;
            font-size: 16px;
        }
        ${styles}
    </style>
    ${scripts}
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>`;
};

/**
 * 1. ASOSIY SCAN ENDPOINT - /scan/:id
 */
const scanQR = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { password } = req.query;
  
  // QR ni topish
  const qr = await DynamicQR.findOne({ id, isActive: true });
  if (!qr) {
    const errorContent = `
      <h2 class="qr-title error">❌ QR Code Topilmadi</h2>
      <p>Bu QR code mavjud emas yoki o'chirilgan.</p>
      <div class="stats">QR ID: ${id}</div>
    `;
    return res.status(404).send(generateHTMLResponse('QR Topilmadi', errorContent));
  }
  
  // Password check
  if (!checkQRPassword(qr, password)) {
    const passwordForm = `
      <h2 class="qr-title">🔒 ${qr.title}</h2>
      <p>Bu QR code parol bilan himoyalangan.</p>
      <form method="GET" class="password-form">
        <input type="password" name="password" placeholder="Parolni kiriting" class="password-input" required>
        <button type="submit" class="button">Kirish</button>
      </form>
      <div class="stats">Scan count: ${qr.scanCount}</div>
    `;
    return res.send(generateHTMLResponse('Parol Kerak', passwordForm));
  }
  
  // Scan count va analytics
  await qr.incrementScan();
  await recordScanAnalytics(qr, req);
  
  const content = qr.currentContent;
  
  // Content type ga qarab response
  switch (content.type) {
    case 'empty':
      const emptyContent = `
        <h2 class="qr-title">📱 ${qr.title}</h2>
        <p>Bu QR code hali content ga ega emas.</p>
        <p><em>${content.description || 'Content tez orada qo\'shiladi'}</em></p>
        <div class="stats">Scan count: ${qr.scanCount}</div>
      `;
      return res.send(generateHTMLResponse(qr.title, emptyContent));
      
    case 'text':
      const textContent = `
        <h2 class="qr-title">📝 ${qr.title}</h2>
        <div class="content">
          <div class="text-content">${content.text}</div>
        </div>
        ${content.description ? `<p><em>${content.description}</em></p>` : ''}
        <div class="stats">
          Scan count: ${qr.scanCount} | 
          Yangilandi: ${new Date(content.lastUpdated).toLocaleDateString('uz-UZ')}
        </div>
      `;
      return res.send(generateHTMLResponse(qr.title, textContent));
      
    case 'link':
      // Direct redirect
      console.log(`🔗 Redirect: ${qr.id} -> ${content.url}`);
      return res.redirect(content.url);
      
    case 'file':
      // File ni serve qilish
      return handleFileServing(qr, content, res);
      
    case 'contact':
      // vCard ni generate qilish yoki contact page
      return handleContactDisplay(qr, content, req, res);
      
    default:
      throw createAppError('Noto\'g\'ri content turi', 500);
  }
});

/**
 * File serving handler
 */
const handleFileServing = async (qr, content, res) => {
  try {
    if (!content.filePath || !fs.existsSync(content.filePath)) {
      const errorContent = `
        <h2 class="qr-title error">❌ Fayl Topilmadi</h2>
        <p>Fayl server da mavjud emas.</p>
        <div class="stats">QR: ${qr.title} | Scan count: ${qr.scanCount}</div>
      `;
      return res.status(404).send(generateHTMLResponse('Fayl Topilmadi', errorContent));
    }
    
    // Fayl turini aniqlash
    const mimeType = content.mimeType;
    const isViewable = mimeType.startsWith('image/') || 
                      mimeType === 'application/pdf' ||
                      mimeType.startsWith('text/') ||
                      mimeType.startsWith('video/') ||
                      mimeType.startsWith('audio/');
    
    // Headers set qilish
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', content.fileSize);
    
    const disposition = isViewable ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${content.originalName}"`);
    
    // File ni stream qilish
    const fileStream = fs.createReadStream(content.filePath);
    fileStream.on('error', (error) => {
      console.error('❌ File stream error:', error);
      res.status(500).send('Faylni yuklashda xatolik');
    });
    
    fileStream.pipe(res);
    
    console.log(`📁 File served: ${qr.id} - ${content.originalName} (${mimeType})`);
    
  } catch (error) {
    console.error('❌ File serving error:', error);
    const errorContent = `
      <h2 class="qr-title error">❌ Server Xatoligi</h2>
      <p>Faylni yuklashda xatolik yuz berdi.</p>
    `;
    res.status(500).send(generateHTMLResponse('Server Xatoligi', errorContent));
  }
};

/**
 * Contact display/download handler
 */
const handleContactDisplay = async (qr, content, req, res) => {
  const { format } = req.query;
  
  if (format === 'vcard' || format === 'vcf') {
    // vCard formatda download
    const vcard = generateVCard(content);
    
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${content.contactName || 'contact'}.vcf"`);
    return res.send(vcard);
  } else {
    // HTML da contact ma'lumotlarini ko'rsatish
    const contactHTML = generateContactHTML(qr, content);
    return res.send(generateHTMLResponse(qr.title, contactHTML));
  }
};

/**
 * vCard generator
 */
const generateVCard = (content) => {
  let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
  
  if (content.contactName) {
    vcard += `FN:${content.contactName}\n`;
    vcard += `N:${content.contactName};;;;\n`;
  }
  
  if (content.phone) {
    vcard += `TEL;TYPE=CELL:${content.phone}\n`;
  }
  
  if (content.email) {
    vcard += `EMAIL:${content.email}\n`;
  }
  
  if (content.company) {
    vcard += `ORG:${content.company}\n`;
  }
  
  vcard += 'END:VCARD';
  return vcard;
};

/**
 * Contact HTML generator
 */
const generateContactHTML = (qr, content) => {
  const downloadUrl = `${qr.scanUrl}?format=vcard`;
  
  return `
    <h2 class="qr-title">👤 ${qr.title}</h2>
    <div class="contact-card">
      ${content.contactName ? `<div class="contact-field"><strong>👤 Ism:</strong> ${content.contactName}</div>` : ''}
      ${content.phone ? `<div class="contact-field"><strong>📞 Telefon:</strong> <a href="tel:${content.phone}">${content.phone}</a></div>` : ''}
      ${content.email ? `<div class="contact-field"><strong>📧 Email:</strong> <a href="mailto:${content.email}">${content.email}</a></div>` : ''}
      ${content.company ? `<div class="contact-field"><strong>🏢 Kompaniya:</strong> ${content.company}</div>` : ''}
    </div>
    <div class="content">
      <a href="${downloadUrl}" class="button">📱 Kontaktga Qo'shish</a>
    </div>
    ${content.description ? `<p><em>${content.description}</em></p>` : ''}
    <div class="stats">
      Scan count: ${qr.scanCount} | 
      Yangilandi: ${new Date(content.lastUpdated).toLocaleDateString('uz-UZ')}
    </div>
  `;
};

/**
 * 2. QR INFO ENDPOINT - /api/scan-info/:id
 */
const getQRScanInfo = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const qr = await DynamicQR.findOne({ id, isActive: true })
    .select('id title currentContent scanCount lastScanned createdDate settings');
    
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  // Password protected bo'lsa, limited info qaytarish
  if (qr.settings?.password) {
    return res.json({
      success: true,
      qr: {
        id: qr.id,
        title: qr.title,
        contentType: qr.currentContent.type,
        scanCount: qr.scanCount,
        createdDate: qr.createdDate,
        isPasswordProtected: true,
        description: 'Bu QR code parol bilan himoyalangan'
      }
    });
  }
  
  // Public info
  const response = {
    id: qr.id,
    title: qr.title,
    contentType: qr.currentContent.type,
    scanCount: qr.scanCount,
    lastScanned: qr.lastScanned,
    createdDate: qr.createdDate,
    isPasswordProtected: false
  };
  
  // Content type ga qarab qo'shimcha ma'lumot
  switch (qr.currentContent.type) {
    case 'text':
      response.preview = qr.currentContent.text?.substring(0, 100) + 
                        (qr.currentContent.text?.length > 100 ? '...' : '');
      break;
    case 'link':
      response.linkTitle = qr.currentContent.linkTitle;
      response.domain = new URL(qr.currentContent.url).hostname;
      break;
    case 'file':
      response.fileName = qr.currentContent.originalName;
      response.fileSize = qr.currentContent.fileSize;
      response.fileType = qr.currentContent.mimeType;
      break;
    case 'contact':
      response.contactName = qr.currentContent.contactName;
      response.hasPhone = !!qr.currentContent.phone;
      response.hasEmail = !!qr.currentContent.email;
      break;
  }
  
  if (qr.currentContent.description) {
    response.description = qr.currentContent.description;
  }
  
  res.json({
    success: true,
    qr: response
  });
});

/**
 * 3. QR PREVIEW ENDPOINT - /api/preview/:id
 */
const previewQR = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const qr = await DynamicQR.findOne({ id, isActive: true })
    .select('id title currentContent scanCount createdDate');
    
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  // Preview HTML (scan count oshirmay)
  const content = qr.currentContent;
  let previewContent = '';
  
  switch (content.type) {
    case 'empty':
      previewContent = `
        <h2 class="qr-title">📱 ${qr.title}</h2>
        <p><em>Preview Mode - Scan count oshirilmaydi</em></p>
        <p>Bu QR code hali content ga ega emas.</p>
        <div class="stats">Scan count: ${qr.scanCount}</div>
      `;
      break;
      
    case 'text':
      const textPreview = content.text.length > 200 ? 
        content.text.substring(0, 200) + '...' : content.text;
      previewContent = `
        <h2 class="qr-title">📝 ${qr.title} (Preview)</h2>
        <div class="content">
          <div class="text-content">${textPreview}</div>
        </div>
        <p><em>Preview Mode - To'liq ko'rish uchun QR ni scan qiling</em></p>
        <div class="stats">Scan count: ${qr.scanCount}</div>
      `;
      break;
      
    case 'link':
      previewContent = `
        <h2 class="qr-title">🔗 ${qr.title} (Preview)</h2>
        <p><strong>Link:</strong> ${content.linkTitle || content.url}</p>
        <p><em>Preview Mode - Redirect qilinmaydi</em></p>
        <a href="${content.url}" target="_blank" class="button">Linkni Ochish</a>
        <div class="stats">Scan count: ${qr.scanCount}</div>
      `;
      break;
      
    case 'file':
      previewContent = `
        <h2 class="qr-title">📁 ${qr.title} (Preview)</h2>
        <p><strong>Fayl:</strong> ${content.originalName}</p>
        <p><strong>Hajmi:</strong> ${(content.fileSize / 1024 / 1024).toFixed(2)} MB</p>
        <p><strong>Turi:</strong> ${content.mimeType}</p>
        <p><em>Preview Mode - Fayl yuklanmaydi</em></p>
        <div class="stats">Scan count: ${qr.scanCount}</div>
      `;
      break;
      
    case 'contact':
      previewContent = `
        <h2 class="qr-title">👤 ${qr.title} (Preview)</h2>
        <div class="contact-card">
          ${content.contactName ? `<div class="contact-field"><strong>Ism:</strong> ${content.contactName}</div>` : ''}
          ${content.phone ? `<div class="contact-field"><strong>Telefon:</strong> ${content.phone}</div>` : ''}
          ${content.email ? `<div class="contact-field"><strong>Email:</strong> ${content.email}</div>` : ''}
          ${content.company ? `<div class="contact-field"><strong>Kompaniya:</strong> ${content.company}</div>` : ''}
        </div>
        <p><em>Preview Mode - vCard yuklanmaydi</em></p>
        <div class="stats">Scan count: ${qr.scanCount}</div>
      `;
      break;
  }
  
  res.send(generateHTMLResponse(`${qr.title} - Preview`, previewContent));
});

/**
 * 4. SCAN STATISTICS - /api/scan-stats/:id
 */
const getScanStats = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const qr = await DynamicQR.findOne({ id, isActive: true })
    .select('id title scanCount lastScanned createdDate currentContent.lastUpdated');
    
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  // Basic statistics
  const daysSinceCreated = Math.floor((Date.now() - qr.createdDate) / (1000 * 60 * 60 * 24));
  const avgScansPerDay = daysSinceCreated > 0 ? (qr.scanCount / daysSinceCreated).toFixed(2) : qr.scanCount;
  
  const stats = {
    qrId: qr.id,
    title: qr.title,
    totalScans: qr.scanCount,
    createdDate: qr.createdDate,
    lastScanned: qr.lastScanned,
    lastContentUpdate: qr.currentContent.lastUpdated,
    daysSinceCreated,
    avgScansPerDay: parseFloat(avgScansPerDay),
    isActive: true
  };
  
  // Bugungi scan statistikasi (sodda implementatsiya)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  if (qr.lastScanned && qr.lastScanned >= todayStart) {
    stats.scannedToday = true;
  } else {
    stats.scannedToday = false;
  }
  
  res.json({
    success: true,
    stats
  });
});

/**
 * 5. REDIRECT HANDLER - /r/:id (qisqa URL)
 */
const quickRedirect = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const qr = await DynamicQR.findOne({ id, isActive: true })
    .select('id currentContent scanCount');
    
  if (!qr) {
    return res.status(404).send('QR topilmadi');
  }
  
  // Faqat link type uchun direct redirect
  if (qr.currentContent.type === 'link') {
    await qr.incrementScan();
    await recordScanAnalytics(qr, req);
    return res.redirect(qr.currentContent.url);
  } else {
    // Boshqa content typelar uchun scan page ga redirect
    return res.redirect(`/scan/${id}`);
  }
});

/**
 * 6. QR CODE IMAGE SERVE - /qr-image/:id
 */
const serveQRImage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { size } = req.query;
  
  const qr = await DynamicQR.findOne({ id })
    .select('id qrCodePath title');
    
  if (!qr) {
    throw createAppError('QR topilmadi', 404);
  }
  
  if (!fs.existsSync(qr.qrCodePath)) {
    throw createAppError('QR rasm fayli topilmadi', 404);
  }
  
  // Cache headers
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 soat cache
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="qr_${qr.id}.png"`);
  
  // Size parameter bo'yicha resize (sodda implementatsiya)
  if (size && ['small', 'medium', 'large'].includes(size)) {
    // Bu yerda sharp yoki jimp library bilan resize qilish mumkin
    // Hozircha original rasmni qaytaramiz
    console.log(`📷 QR image requested: ${id} (${size})`);
  }
  
  // Image ni stream qilish
  const imageStream = fs.createReadStream(qr.qrCodePath);
  imageStream.on('error', (error) => {
    console.error('❌ QR image stream error:', error);
    res.status(500).send('Rasm yuklashda xatolik');
  });
  
  imageStream.pipe(res);
});

/**
 * 7. CUSTOM DOMAIN HANDLER (ixtiyoriy)
 */
const handleCustomDomain = catchAsync(async (req, res, next) => {
  // Bu endpoint custom domain bilan kelgan requestlarni handle qilish uchun
  const { subdomain } = req.params;
  
  const qr = await DynamicQR.findOne({ 
    'settings.customDomain': subdomain,
    isActive: true 
  });
  
  if (!qr) {
    throw createAppError('Custom domain topilmadi', 404);
  }
  
  // Asosiy scan logikasiga redirect
  req.params.id = qr.id;
  return scanQR(req, res, next);
});

/**
 * Error handling uchun generic 404 page
 */
const handle404 = (req, res) => {
  const errorContent = `
    <h2 class="qr-title error">❌ Sahifa Topilmadi</h2>
    <p>Siz qidirayotgan sahifa mavjud emas.</p>
    <p><strong>URL:</strong> ${req.originalUrl}</p>
    <a href="/" class="button">Bosh sahifaga qaytish</a>
  `;
  res.status(404).send(generateHTMLResponse('404 - Sahifa Topilmadi', errorContent));
};

module.exports = {
  scanQR,
  getQRScanInfo,
  previewQR,
  getScanStats,
  quickRedirect,
  serveQRImage,
  handleCustomDomain,
  handle404,
  generateHTMLResponse // Export qilish utility functionlar uchun
};