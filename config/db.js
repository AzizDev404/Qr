const mongoose = require('mongoose');

/**
 * MongoDB ga ulanish funktsiyasi
 * Updated for latest Mongoose version
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable aniqlanmagan!');
    }

    console.log('📡 MongoDB ga ulanmoqda...');
    
    // Updated connection options for latest Mongoose
    const conn = await mongoose.connect(mongoURI, {
      // Modern connection options
      maxPoolSize: 10,        // Connection pool size
      serverSelectionTimeoutMS: 5000, // 5 soniya timeout
      socketTimeoutMS: 45000, // 45 soniya socket timeout
      family: 4               // IPv4 ni majburlash
    });

    console.log(`✅ MongoDB ulandi: ${conn.connection.host}`);
    console.log(`📊 Database nomi: ${conn.connection.name}`);
    
    // Connection events
    mongoose.connection.on('connected', () => {
      console.log('🔗 MongoDB connected');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });

    return conn;
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // Retry logic
    console.log('🔄 5 soniyadan keyin qayta urinish...');
    setTimeout(connectDB, 5000);
  }
};

/**
 * Graceful shutdown uchun connection yopish
 */
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('🔒 MongoDB connection yopildi');
  } catch (error) {
    console.error('❌ Database yopishda xatolik:', error);
  }
};

module.exports = {
  connectDB,
  closeDB
};