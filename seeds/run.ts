import { readFileSync, existsSync } from 'node:fs';
import mongoose from 'mongoose';

function loadEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

async function main(): Promise<void> {
  loadEnv('.env.local');
  const { connectDB } = await import('../src/lib/db/connection');
  const { seedCommonCodes } = await import('../src/lib/codes/seed');
  await connectDB();
  const n = await seedCommonCodes();
  console.log(`[seed] CommonCode ${n}건 upsert 완료 (db=${process.env.MONGODB_DBNAME})`);
  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error('[seed] 실패:', err);
  process.exit(1);
});
