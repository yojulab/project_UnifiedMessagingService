import { notFound, ok, parseBody, toObjectId, withAuth } from '@/lib/api';
import { PlatformConfig } from '@/lib/db/models/PlatformConfig';
import {
  assertRequired, decryptConfig, encryptConfig, getProvider, mergeMasked, normalizeInput,
  providerNameMap, runConnectionTest, setDefault, toView,
} from '@/lib/platform/configService';
import { PlatformConfigUpdateSchema } from '@/lib/validators/schemas';
import type { Channel } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withAuth<Ctx>(async (req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '플랫폼 설정');
  const input = await parseBody(req, PlatformConfigUpdateSchema);
  const doc = await PlatformConfig.findOne({ _id: id, userId: user.oid });
  if (!doc) throw notFound('플랫폼 설정');

  if (input.name !== undefined) doc.name = input.name;
  let test = null;
  if (input.configData) {
    const provider = await getProvider(doc.provider);
    const merged = mergeMasked(input.configData, decryptConfig(doc.configData));
    const plain = normalizeInput(merged, provider.template);
    assertRequired(plain, provider.template);
    test = await runConnectionTest(doc.channel as Channel, doc.provider, plain);
    doc.configData = encryptConfig(plain, provider.template);
    doc.markModified('configData');
    doc.status = test.connected ? 'ACTIVE' : 'ERROR';
    doc.lastTestMessage = test.message;
    doc.lastTestedAt = new Date();
  }
  if (input.isDefault !== undefined) doc.isDefault = input.isDefault;
  await doc.save();
  if (doc.isDefault) await setDefault(user.oid, doc.channel as Channel, doc._id);
  return ok({ config: toView(doc.toObject(), await providerNameMap()), test });
});

export const DELETE = withAuth<Ctx>(async (_req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '플랫폼 설정');
  const res = await PlatformConfig.deleteOne({ _id: id, userId: user.oid });
  if (res.deletedCount === 0) throw notFound('플랫폼 설정');
  return ok({ deleted: true });
});
