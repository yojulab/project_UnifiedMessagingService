import mongoose, { type Connection } from 'mongoose';

let conn: Connection | null = null;

export function e2eDbName(): string {
  const name = process.env.E2E_MONGODB_DBNAME ?? '';
  // dev/prod DB 삭제·오염 방지 가드
  if (!name.endsWith('_e2e')) throw new Error(`E2E DB 이름이 _e2e 로 끝나지 않습니다: "${name}"`);
  return name;
}

/** E2E 전용 DB 연결 (테스트 단언용 직접 조회) */
export async function db(): Promise<Connection> {
  if (conn) return conn;
  conn = await mongoose
    .createConnection(process.env.E2E_MONGODB_URI ?? 'mongodb://host.docker.internal:27017', { dbName: e2eDbName() })
    .asPromise();
  return conn;
}

export async function closeDb(): Promise<void> {
  await conn?.close();
  conn = null;
}

export async function findOne(collection: string, filter: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return (await db()).collection(collection).findOne(filter);
}

export async function find(collection: string, filter: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  return (await db()).collection(collection).find(filter).toArray();
}
