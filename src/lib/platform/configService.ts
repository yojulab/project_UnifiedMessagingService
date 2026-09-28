import { Types } from 'mongoose';
import { AppError } from '@/lib/api';
import { AdapterFactory } from '@/lib/adapters/AdapterFactory';
import type { AdapterConfig, TestResult } from '@/lib/adapters/IMessagingAdapter';
import { errorMessage } from '@/lib/adapters/IMessagingAdapter';
import { CommonCode } from '@/lib/db/models/CommonCode';
import { PlatformConfig, type PlatformConfigType } from '@/lib/db/models/PlatformConfig';
import { decrypt, encrypt, isEncrypted, mask } from '@/lib/encryption';
import { normalizeOptOutNumber } from '@/lib/validators/contactNormalizer';
import type { Channel, ConfigTemplate } from '@/types';

const SECRET_KEY_RE = /(secret|key|token|password)/i;
export const MASK_PREFIX = '****';

export interface ProviderInfo {
  code: string;
  name: string;
  channels: Channel[];
  template: ConfigTemplate;
}

export async function getProvider(code: string): Promise<ProviderInfo> {
  const doc = await CommonCode.findOne({ category: 'PROVIDER', code, isActive: true }).lean();
  if (!doc) throw new AppError(400, 'UNKNOWN_PROVIDER', `등록되지 않은 공급사입니다: ${code}`);
  let template: ConfigTemplate = {};
  try {
    template = doc.configTemplate ? (JSON.parse(doc.configTemplate) as ConfigTemplate) : {};
  } catch {
    template = {};
  }
  return { code: doc.code, name: doc.name, channels: (doc.channels ?? []) as Channel[], template };
}

export function isSecretField(key: string, template: ConfigTemplate): boolean {
  return template[key]?.secret === true || (SECRET_KEY_RE.test(key) && key !== 'kakaoTemplateId');
}

/** 입력 평문 설정을 검증·정리한다 (필수값, 080 번호 형식, 템플릿 기본값 반영). */
export function normalizeInput(input: Record<string, string>, template: ConfigTemplate): AdapterConfig {
  const out: AdapterConfig = {};
  for (const [k, field] of Object.entries(template)) {
    const v = (input[k] ?? '').trim() || field.default || '';
    if (v) out[k] = v;
  }
  // 템플릿에 없는 키는 extra 로 보존하지 않고 무시한다 (예상치 못한 비밀값 평문 저장 방지)
  if (out.optOutNumber) {
    const n = normalizeOptOutNumber(out.optOutNumber);
    if (!n) throw new AppError(400, 'INVALID_OPT_OUT', '080 수신거부 번호 형식이 올바르지 않습니다. (예: 080-123-4567)');
    out.optOutNumber = n;
  }
  if (out.unitCost && !/^\d+(\.\d+)?$/.test(out.unitCost)) {
    throw new AppError(400, 'INVALID_UNIT_COST', '건당 단가는 숫자여야 합니다.');
  }
  return out;
}

export function assertRequired(config: AdapterConfig, template: ConfigTemplate): void {
  const missing = Object.entries(template)
    .filter(([k, f]) => f.required && !config[k])
    .map(([k, f]) => f.label || k);
  if (missing.length) throw new AppError(400, 'MISSING_FIELDS', `필수 항목 누락: ${missing.join(', ')}`);
}

export function encryptConfig(plain: AdapterConfig, template: ConfigTemplate): Record<string, string> {
  return Object.fromEntries(Object.entries(plain).map(([k, v]) => [k, isSecretField(k, template) ? encrypt(v) : v]));
}

export function decryptConfig(stored: unknown): AdapterConfig {
  const obj = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const out: AdapterConfig = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string') continue;
    out[k] = isEncrypted(v) ? decrypt(v) : v;
  }
  return out;
}

export function maskConfig(stored: unknown): Record<string, string> {
  const obj = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string') continue;
    out[k] = isEncrypted(v) ? mask(decrypt(v)) : v;
  }
  return out;
}

/** 수정 시 마스킹 값(`****`)이 그대로 들어오면 기존 평문으로 대체한다. */
export function mergeMasked(input: Record<string, string>, existingPlain: AdapterConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = v.startsWith(MASK_PREFIX) && existingPlain[k] ? existingPlain[k] : v;
  }
  for (const [k, v] of Object.entries(existingPlain)) if (!(k in out)) out[k] = v;
  return out;
}

export function assertChannelSupported(channel: Channel, provider: ProviderInfo): void {
  if (!provider.channels.includes(channel) || !AdapterFactory.isSupported(channel, provider.code)) {
    throw new AppError(400, 'UNSUPPORTED_CHANNEL', `${provider.name} 은(는) ${channel} 채널을 지원하지 않습니다.`);
  }
}

export async function runConnectionTest(channel: Channel, provider: string, plain: AdapterConfig): Promise<TestResult> {
  try {
    const adapter = AdapterFactory.create(channel, provider, plain);
    return await adapter.testConnection();
  } catch (err) {
    return { connected: false, message: errorMessage(err) };
  }
}

export interface PlatformConfigView {
  id: string;
  name: string;
  channel: Channel;
  provider: string;
  providerName: string;
  configData: Record<string, string>;
  isDefault: boolean;
  status: string;
  lastTestMessage: string;
  lastTestedAt: string | null;
  updatedAt: string | null;
}

type StoredConfig = PlatformConfigType & { _id: Types.ObjectId; updatedAt?: Date };

export function toView(doc: StoredConfig, providerNames: Record<string, string>): PlatformConfigView {
  return {
    id: String(doc._id),
    name: doc.name ?? '',
    channel: doc.channel as Channel,
    provider: doc.provider,
    providerName: providerNames[doc.provider] ?? doc.provider,
    configData: maskConfig(doc.configData),
    isDefault: Boolean(doc.isDefault),
    status: doc.status ?? 'PENDING',
    lastTestMessage: doc.lastTestMessage ?? '',
    lastTestedAt: doc.lastTestedAt ? doc.lastTestedAt.toISOString() : null,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
  };
}

export async function providerNameMap(): Promise<Record<string, string>> {
  const docs = await CommonCode.find({ category: 'PROVIDER' }, { code: 1, name: 1 }).lean();
  return Object.fromEntries(docs.map((d) => [d.code, d.name]));
}

/** 같은 userId+channel 의 다른 설정의 isDefault 를 해제한다. */
export async function setDefault(userId: Types.ObjectId, channel: Channel, keepId: Types.ObjectId): Promise<void> {
  await PlatformConfig.updateMany({ userId, channel, _id: { $ne: keepId } }, { $set: { isDefault: false } });
}

/** 테넌트 소유 설정을 복호화하여 로드 (발송 엔진용) */
export async function loadDecryptedConfig(
  userId: Types.ObjectId,
  configId: Types.ObjectId,
): Promise<{ doc: StoredConfig; plain: AdapterConfig }> {
  const doc = (await PlatformConfig.findOne({ _id: configId, userId }).lean()) as StoredConfig | null;
  if (!doc) throw new AppError(404, 'NOT_FOUND', '플랫폼 설정을 찾을 수 없습니다.');
  return { doc, plain: decryptConfig(doc.configData) };
}
