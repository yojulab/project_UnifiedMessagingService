import { AppError, ok, parseBody, withAuth } from '@/lib/api';
import { PlatformConfig } from '@/lib/db/models/PlatformConfig';
import {
  assertChannelSupported, assertRequired, encryptConfig, getProvider, normalizeInput,
  providerNameMap, runConnectionTest, setDefault, toView,
} from '@/lib/platform/configService';
import { PlatformConfigInputSchema } from '@/lib/validators/schemas';

export const GET = withAuth(async (req, _ctx, user) => {
  const channel = req.nextUrl.searchParams.get('channel');
  const status = req.nextUrl.searchParams.get('status');
  const filter: Record<string, unknown> = { userId: user.oid };
  if (channel) filter.channel = channel;
  if (status) filter.status = status;
  const [docs, names] = await Promise.all([
    PlatformConfig.find(filter).sort({ channel: 1, isDefault: -1, updatedAt: -1 }).lean(),
    providerNameMap(),
  ]);
  return ok(docs.map((d) => toView(d, names)));
});

export const POST = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, PlatformConfigInputSchema);
  const provider = await getProvider(input.provider);
  assertChannelSupported(input.channel, provider);
  const plain = normalizeInput(input.configData, provider.template);
  assertRequired(plain, provider.template);

  const exists = await PlatformConfig.exists({ userId: user.oid, channel: input.channel, provider: input.provider });
  if (exists) throw new AppError(409, 'DUPLICATE_CONFIG', '같은 채널·공급사 설정이 이미 있습니다. 기존 설정을 수정하세요.');

  const test = await runConnectionTest(input.channel, input.provider, plain);
  const hasDefault = await PlatformConfig.exists({ userId: user.oid, channel: input.channel, isDefault: true });
  const doc = await PlatformConfig.create({
    userId: user.oid,
    name: input.name || provider.name,
    channel: input.channel,
    provider: input.provider,
    configData: encryptConfig(plain, provider.template),
    isDefault: input.isDefault || !hasDefault,
    status: test.connected ? 'ACTIVE' : 'ERROR',
    lastTestMessage: test.message,
    lastTestedAt: new Date(),
  });
  if (doc.isDefault) await setDefault(user.oid, input.channel, doc._id);
  return ok({ config: toView(doc.toObject(), await providerNameMap()), test }, 201);
});
