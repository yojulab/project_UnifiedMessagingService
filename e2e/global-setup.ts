import bcrypt from 'bcryptjs';
import { closeDb, db, e2eDbName } from './helpers/db';
import { USER_A, USER_B } from './fixtures/users';
import { commonCodeSeeds } from '../src/lib/codes/seedData';

/** E2E 전용 DB 초기화 → CommonCode 시드 → 테스트 회원 2명 생성 */
export default async function globalSetup(): Promise<void> {
  const name = e2eDbName(); // _e2e 가드 (아니면 throw)
  const conn = await db();
  if (conn.db?.databaseName !== name) throw new Error(`연결된 DB(${conn.db?.databaseName}) 가 E2E DB 가 아닙니다.`);
  await conn.dropDatabase();

  const now = new Date();
  await conn.collection('commoncodes').insertMany(
    commonCodeSeeds.map((s) => ({ ...s, channels: s.channels ?? [], configTemplate: s.configTemplate ?? null, isActive: true, createdAt: now, updatedAt: now })),
  );
  await conn.collection('commoncodes').createIndex({ category: 1, code: 1 }, { unique: true });

  for (const u of [USER_A, USER_B]) {
    await conn.collection('users').insertOne({
      email: u.email,
      passwordHash: await bcrypt.hash(u.password, 12),
      name: u.name,
      company: u.company,
      defaultSenderPhone: '',
      defaultSenderEmail: u.email,
      themeMode: 'light',
      accentColor: 'blue',
      createdAt: now,
      updatedAt: now,
    });
  }
  await conn.collection('users').createIndex({ email: 1 }, { unique: true });
  await closeDb();
}
