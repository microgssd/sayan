import './dns-fix';
import mongoose from 'mongoose';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
declare global {
  // eslint-disable-next-line no-var
  var _mongoose: Cache | undefined;
}

const cached: Cache = global._mongoose ?? (global._mongoose = { conn: null, promise: null });

export async function connectDB() {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  cached.promise ??= mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 8000 });
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
