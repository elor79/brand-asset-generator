import mongoose from 'mongoose';

export async function connectMongoDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cantoflow';

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✓ MongoDB connected');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
}

export default mongoose;
