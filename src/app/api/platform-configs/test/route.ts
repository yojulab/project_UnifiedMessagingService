import { ok, parseBody, toObjectId, withAuth } from '@/lib/api';
import { PlatformConfig } from '@/lib/db/models/PlatformConfig';
import {
  assertChannelSupported, assertRequired, decryptConfig, getProvider, mergeMasked, normalizeInput, runConnectionTest,
} from '@/lib/platform/configService';
import { PlatformConfigTestSchema } from '@/lib/validators/schemas';

/** 저장 없이 입력값으로 연결 테스트 (수정 중이면 id 로 마스킹 값 보완) */
export const POST = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, PlatformConfigTestSchema);
  const provider = await getProvider(input.provider);
  assertChannelSupported(input.channel, provider);
  let raw = input.configData;
  if (input.id) {
    const existing = await PlatformConfig.findOne({ _id: toObjectId(input.id), userId: user.oid }).lean();
    if (existing) raw = mergeMasked(raw, decryptConfig(existing.configData));
  }
  const plain = normalizeInput(raw, provider.template);
  assertRequired(plain, provider.template);
  return ok(await runConnectionTest(input.channel, input.provider, plain));
});
