import type { Channel } from '@/types';

export interface SendPayload {
  recipient: string;
  subject?: string;
  /** SMS/LMS/KAKAO 본문 또는 이메일 텍스트 본문 */
  body: string;
  /** 이메일 HTML 본문 */
  html?: string;
  senderAddress?: string;
  /** 이메일 추가 헤더 (List-Unsubscribe 등) */
  headers?: Record<string, string>;
  /** SMS 계열 실제 전송 유형 (본문 바이트 기준 판정 결과) */
  smsType?: 'SMS' | 'LMS';
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  resultCode: 'SUCCESS' | 'FAILED' | 'BOUNCED';
  errorMessage?: string;
  providerResponse?: unknown;
}

export interface TestResult {
  connected: boolean;
  message: string;
  providerInfo?: Record<string, unknown>;
}

export type AdapterConfig = Record<string, string>;

export interface IMessagingAdapter {
  readonly channel: Channel;
  readonly provider: string;
  send(payload: SendPayload): Promise<SendResult>;
  testConnection(): Promise<TestResult>;
}

export function requireFields(config: AdapterConfig, fields: string[], provider: string): void {
  const missing = fields.filter((f) => !config[f]?.trim());
  if (missing.length) throw new Error(`${provider} 설정 누락: ${missing.join(', ')}`);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '알 수 없는 오류';
}

/** fetch 응답을 JSON 으로 읽되 실패 시 텍스트로 보존 */
export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}
