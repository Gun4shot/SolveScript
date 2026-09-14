const mongoose = require('mongoose');

let reconnectTimer;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectDB, 10000);
  }
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, isDatabaseReady };
