# 🎯 Dynamic QR Code Backend System

**Real-time QR Content Management System** - Bir marta QR yarating, istalgan vaqtda content ni o'zgartiring!

## 🌟 Features

### ✅ **Dynamic Content Types**
- 📝 **Text** - Matn, announcement, notification
- 🔗 **Link** - Website, social media, video URL
- 📁 **File** - PDF, rasm, video, audio, document
- 👤 **Contact** - vCard format, telefon kontaktga qo'shish
- 🔄 **Real-time Update** - QR code o'zgarmaydi, content almashadi

### 🛡️ **Security & Management**
- 🔐 Admin authentication system
- 🚫 Rate limiting va login attempt protection
- 📊 Detailed analytics va scan tracking
- 🗑️ Soft delete va restore functionality
- 🔒 Password protected QR codes

### 🚀 **Performance & Scalability**
- 📱 Mobile-optimized scan pages
- 🎨 Responsive HTML templates
- ⚡ File streaming va caching
- 📈 Pagination va filtering
- 🔍 Search functionality

## 🏗️ **Architecture**

```
Dynamic QR System
├── 🎯 QR Generator (One-time creation)
├── 📊 Content Manager (Real-time updates)
├── 📱 Public Scan Interface
├── 🔧 Admin Dashboard API
└── 📈 Analytics & Statistics
```

## 📦 **Installation**

### **1. Repository Clone**
```bash
git clone <repository-url>
cd dynamic-qr-backend
```

### **2. Dependencies Install**
```bash
npm install
```

### **3. Environment Setup**
`.env` fayl yarating:
```env
# Server Configuration
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3001

# Database
MONGODB_URI=mongodb://localhost:27017/dynamic_qr_db

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# File Upload Settings
MAX_FILE_SIZE=104857600  # 100MB
```

### **4. MongoDB Setup**
```bash
# Local MongoDB
mongod

# Yoki MongoDB Atlas connection string ishlatish
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dynamic_qr_db
```

### **5. Server Start**
```bash
# Development
npm run dev

# Production
npm start
```

## 🎯 **Quick Start Guide**

### **1. QR Yaratish**
```bash
POST /api/qr/create
{
  "title": "Mening QR kodim",
  "description": "Test QR code"
}
```

### **2. Content Qo'shish**

**Text Content:**
```bash
PUT /api/qr/:id/content
{
  "contentType": "text",
  "text": "Salom dunyo! Bu dynamic content.",
  "description": "Test matni"
}
```

**Link Content:**
```bash
PUT /api/qr/:id/content
{
  "contentType": "link",
  "url": "https://youtube.com/watch?v=example",
  "linkTitle": "Qiziq video"
}
```

**File Upload:**
```bash
PUT /api/qr/:id/content
Content-Type: multipart/form-data

contentType: "file"
file: [actual file]
description: "Mening faylim"
```

**Contact Card:**
```bash
PUT /api/qr/:id/content
{
  "contentType": "contact",
  "contactName": "John Doe",
  "phone": "+998901234567",
  "email": "john@example.com",
  "company": "ABC Corp"
}
```

### **3. QR Scan**
```
https://yourdomain.com/scan/QR_ID
```

## 📚 **API Documentation**

### **🔐 Authentication**
```
POST /api/auth/login      # Admin login
POST /api/auth/logout     # Admin logout
GET  /api/auth/status     # Check auth status
```

### **🎯 QR Management**
```
POST   /api/qr/create           # Create new QR
GET    /api/qr                  # List all QRs
GET    /api/qr/:id              # Get QR details
PUT    /api/qr/:id/content      # Update QR content
DELETE /api/qr/:id              # Delete QR
POST   /api/qr/:id/restore      # Restore QR
GET    /api/qr/stats            # System statistics
```

### **📱 Public Endpoints**
```
GET /scan/:id              # Main scan endpoint
GET /r/:id                 # Quick redirect
GET /preview/:id           # Preview without scan count
GET /qr-image/:id          # QR code image
GET /api/scan-info/:id     # Public QR info
```

## 🗂️ **File Structure**

```
dynamic-qr-backend/
├── 📄 server.js                # Main server
├── 📦 package.json             # Dependencies
├── 🔧 .env                     # Environment variables
├── config/
│   └── db.js                   # Database connection
├── models/
│   └── DynamicQR.js            # MongoDB schema
├── controllers/
│   ├── authController.js       # Authentication logic
│   ├── qrController.js         # QR CRUD operations
│   └── scanController.js       # Public scan handling
├── routes/
│   ├── auth.js                 # Auth routes
│   ├── qr.js                   # QR management routes
│   └── scan.js                 # Public scan routes
├── middleware/
│   ├── upload.js               # File upload setup
│   └── errorHandler.js         # Error handling
├── utils/
│   └── qrGenerator.js          # QR code generation
├── uploads/                    # File storage
│   ├── qrcodes/               # Generated QR images
│   └── dynamic-files/         # User uploaded files
└── 📖 README.md               # Documentation
```

## 🔧 **Configuration Options**

### **Environment Variables**
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3001 | No |
| `MONGODB_URI` | Database connection | - | Yes |
| `ADMIN_USERNAME` | Admin username | - | Yes |
| `ADMIN_PASSWORD` | Admin password | - | Yes |
| `BASE_URL` | Public URL | http://localhost:3001 | No |
| `MAX_FILE_SIZE` | Max upload size (bytes) | 104857600 | No |

### **File Upload Support**
- 📷 **Images:** JPG, PNG, GIF, WebP
- 🎥 **Videos:** MP4, AVI, MOV, WebM
- 🎵 **Audio:** MP3, WAV, AAC
- 📄 **Documents:** PDF, DOC, XLSX, PPT
- 🔒 **Security:** Xavfli fayl turlari blocked

## 📊 **Usage Examples**

### **Real-world Use Cases**

**1. Restaurant Menu QR**
```javascript
// QR yaratish
POST /api/qr/create { "title": "Restaurant Menu" }

// PDF menu yuklash
PUT /api/qr/:id/content 
- contentType: "file"
- file: menu.pdf

// Keyinchalik yangi menu
PUT /api/qr/:id/content
- contentType: "file" 
- file: new_menu.pdf
```

**2. Event Information QR**
```javascript
// Dastlab event link
PUT /api/qr/:id/content {
  "contentType": "link",
  "url": "https://eventbrite.com/event/12345"
}

// Event tugaganidan keyin thank you message
PUT /api/qr/:id/content {
  "contentType": "text", 
  "text": "Eventda qatnashganingiz uchun rahmat!"
}
```

**3. Contact Card QR**
```javascript
PUT /api/qr/:id/content {
  "contentType": "contact",
  "contactName": "Jasur Abdullayev",
  "phone": "+998901234567", 
  "email": "jasur@company.com",
  "company": "Tech Solutions LLC"
}
```

## 🚀 **Production Deployment**

### **1. Environment Setup**
```env
NODE_ENV=production
BASE_URL=https://yourdomain.com
MONGODB_URI=mongodb+srv://...
```

### **2. Security Considerations**
- 🔐 Strong admin passwords
- 🛡️ CORS configuration
- 🔒 HTTPS setup
- 🚫 Rate limiting
- 📝 Logging setup

### **3. Recommended Stack**
- **Server:** Ubuntu 20.04+ / CentOS 8+
- **Runtime:** Node.js 16+
- **Database:** MongoDB 5.0+
- **Reverse Proxy:** Nginx
- **Process Manager:** PM2
- **SSL:** Let's Encrypt

### **4. PM2 Setup**
```bash
npm install -g pm2
pm2 start server.js --name "dynamic-qr"
pm2 startup
pm2 save
```

## 🐛 **Troubleshooting**

### **Common Issues**

**Database Connection Error:**
```bash
# MongoDB service check
sudo systemctl status mongod

# Connection string validation
node -e "console.log(process.env.MONGODB_URI)"
```

**File Upload Issues:**
```bash
# Directory permissions
sudo chown -R node:node uploads/
sudo chmod -R 755 uploads/
```

**QR Image Generation:**
```bash
# Check qrcode package
npm list qrcode

# Verify uploads/qrcodes directory
ls -la uploads/qrcodes/
```

## 📈 **Performance Monitoring**

### **Key Metrics**
- 📊 QR scan count
- ⏱️ Response time
- 💾 File storage usage
- 🔄 Content update frequency
- 👥 User analytics

### **Logging**
```javascript
// Development
console.log("📡 Request received")
console.log("✅ QR created successfully") 
console.log("❌ Error occurred")

// Production  
// Winston logger yoki similar logging solution
```

## 🤝 **Contributing**

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 **License**

MIT License - see LICENSE file for details

## 🆘 **Support**

- 📧 **Email:** support@yourdomain.com
- 📚 **Docs:** https://docs.yourdomain.com
- 🐛 **Issues:** GitHub Issues
- 💬 **Chat:** Telegram @support

---

**🎯 Dynamic QR Code System - Real-time content management for modern QR solutions!**