import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.mongooseCache ?? { conn: null, promise: null };
globalThis.mongooseCache = cached;

/** Next.js HMR 에서도 연결이 중복되지 않도록 캐시된 싱글턴 연결을 반환한다. */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DBNAME,
      serverSelectionTimeoutMS: 5000,
    });
  }
  try {
    cached.conn = await cached.promise;
    if (process.env.NODE_ENV !== 'test') console.log(`[db] MongoDB 연결 성공 (db=${process.env.MONGODB_DBNAME})`);
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
