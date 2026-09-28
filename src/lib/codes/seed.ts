import { CommonCode } from '@/lib/db/models/CommonCode';
import { commonCodeSeeds } from './seedData';

/** CommonCode 시드를 upsert 한다 (멱등). */
export async function seedCommonCodes(): Promise<number> {
  const ops = commonCodeSeeds.map((s) => ({
    updateOne: {
      filter: { category: s.category, code: s.code },
      update: { $set: { ...s, channels: s.channels ?? [], configTemplate: s.configTemplate ?? null, isActive: true } },
      upsert: true,
    },
  }));
  await CommonCode.bulkWrite(ops);
  return ops.length;
}
