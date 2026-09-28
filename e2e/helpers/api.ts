import { expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import type { FilePayload } from './files';

const BASE = (): string => process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export async function apiContext(storageState: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE(), storageState });
}

export async function apiJson<T>(ctx: APIRequestContext, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data?: unknown): Promise<T> {
  const res = await ctx.fetch(url, { method, data });
  const body = (await res.json()) as { success: boolean; data?: T; error?: { message: string } };
  expect(body.success, `${method} ${url} → ${res.status()} ${body.error?.message ?? ''}`).toBe(true);
  return body.data as T;
}

export interface PlatformInput {
  channel: 'EMAIL' | 'SMS' | 'LMS' | 'KAKAO';
  provider: string;
  configData: Record<string, string>;
  name?: string;
}

/** 채널·공급사 설정이 없으면 생성, 있으면 기존 id 반환 */
export async function ensurePlatform(ctx: APIRequestContext, input: PlatformInput): Promise<string> {
  const list = await apiJson<{ id: string; channel: string; provider: string }[]>(ctx, 'GET', '/api/platform-configs');
  const found = list.find((p) => p.channel === input.channel && p.provider === input.provider);
  if (found) {
    // 다른 스펙이 만든 설정을 재사용할 때도 이름·설정값을 기대 상태로 맞춘다
    await apiJson(ctx, 'PUT', `/api/platform-configs/${found.id}`, { configData: input.configData, ...(input.name ? { name: input.name } : {}) });
    return found.id;
  }
  const r = await apiJson<{ config: { id: string } }>(ctx, 'POST', '/api/platform-configs', input);
  return r.config.id;
}

export const ALIGO_SMS: PlatformInput = {
  channel: 'SMS',
  provider: 'ALIGO',
  name: 'E2E 알리고',
  configData: { apiKey: 'aligo-test-key-1234', userId: 'e2e', senderNumber: '01000000000', optOutNumber: '080-123-4567' },
};

export const SES_EMAIL: PlatformInput = {
  channel: 'EMAIL',
  provider: 'AWS_SES',
  name: 'E2E SES',
  configData: { accessKeyId: 'AKIAE2E', secretAccessKey: 'ses-secret-9999', region: 'ap-northeast-2', senderAddress: 'sender@e2e.test' },
};

/** 업로드 API 로 연락처 적재 (표준 contactRows 형식) */
export async function importContacts(
  ctx: APIRequestContext,
  file: FilePayload,
  opts: { labels?: string[]; duplicateHandling?: 'skip' | 'overwrite' | 'create_new' } = {},
): Promise<{ importedRows: number; updatedRows: number; skippedRows: number }> {
  const res = await ctx.post('/api/contacts/upload/commit', {
    multipart: {
      file,
      options: JSON.stringify({
        duplicateHandling: opts.duplicateHandling ?? 'skip',
        labels: opts.labels ?? [],
        mappedColumns: { name: '이름', phones: ['연락처 1', '연락처 2'], emails: ['이메일 1', '이메일 2'], company: '회사', custom: {} },
      }),
    },
  });
  const body = (await res.json()) as { success: boolean; data: { importedRows: number; updatedRows: number; skippedRows: number }; error?: { message: string } };
  expect(body.success, body.error?.message).toBe(true);
  return body.data;
}

export async function waitForCampaign(ctx: APIRequestContext, id: string, timeoutMs = 20_000): Promise<{ status: string; sentCount: number; failedCount: number; skippedCount: number }> {
  const start = Date.now();
  for (;;) {
    const d = await apiJson<{ status: string; sentCount: number; failedCount: number; skippedCount: number }>(ctx, 'GET', `/api/campaigns/${id}`);
    if (!['PENDING', 'SENDING'].includes(d.status)) return d;
    if (Date.now() - start > timeoutMs) throw new Error(`캠페인 ${id} 가 ${timeoutMs}ms 안에 완료되지 않음 (status=${d.status})`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

export async function contactIdsByLabel(ctx: APIRequestContext, label: string): Promise<{ id: string; name: string }[]> {
  const r = await apiJson<{ items: { id: string; name: string }[] }>(ctx, 'GET', `/api/contacts?label=${encodeURIComponent(label)}&limit=200`);
  return r.items;
}
