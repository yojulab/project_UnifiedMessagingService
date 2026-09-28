import { notFound, ok, toObjectId, withAuth } from '@/lib/api';
import { PlatformConfig } from '@/lib/db/models/PlatformConfig';
import { decryptConfig, runConnectionTest } from '@/lib/platform/configService';
import type { Channel } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

/** 저장된 설정으로 연결 테스트 → status 갱신 */
export const POST = withAuth<Ctx>(async (_req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '플랫폼 설정');
  const doc = await PlatformConfig.findOne({ _id: id, userId: user.oid });
  if (!doc) throw notFound('플랫폼 설정');
  const test = await runConnectionTest(doc.channel as Channel, doc.provider, decryptConfig(doc.configData));
  doc.status = test.connected ? 'ACTIVE' : 'ERROR';
  doc.lastTestMessage = test.message;
  doc.lastTestedAt = new Date();
  await doc.save();
  return ok(test);
});
