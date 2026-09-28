import crypto from 'node:crypto';
import type { Channel } from '@/types';
import type { IMessagingAdapter, SendPayload, SendResult, TestResult } from './IMessagingAdapter';

/** fail-safe: DRY_RUN=false 를 명시한 경우에만 실제 공급사 API 를 호출한다 (미설정 시 차단). */
export function isDryRun(): boolean {
  return process.env.DRY_RUN !== 'false';
}

/**
 * DRY_RUN 모드 — 네트워크 호출 없이 결정적 결과를 반환한다.
 * - 수신자에 `fail` 포함 또는 끝자리 `9999` → FAILED
 * - 수신자에 `bounce` 포함 또는 끝자리 `8888` → BOUNCED
 * - KAKAO 채널에서 끝자리 `7777` → FAILED (LMS 대체 발송 검증용 — 다른 채널은 성공)
 * - 그 외 SUCCESS. 최종 payload 는 providerResponse.dryRunPayload 로 보존한다.
 * - 설정값 중 `invalid` 가 있으면 연결 테스트 실패.
 */
export class DryRunAdapter implements IMessagingAdapter {
  constructor(
    readonly channel: Channel,
    readonly provider: string,
    private readonly config: Record<string, string>,
  ) {}

  async send(payload: SendPayload): Promise<SendResult> {
    const r = payload.recipient.toLowerCase();
    const dryRunPayload = { ...payload };
    if (r.includes('fail') || r.endsWith('9999')) {
      return { success: false, resultCode: 'FAILED', errorMessage: 'DRY_RUN: 시뮬레이션 실패', providerResponse: { dryRun: true, dryRunPayload } };
    }
    if (this.channel === 'KAKAO' && r.endsWith('7777')) {
      return { success: false, resultCode: 'FAILED', errorMessage: 'DRY_RUN: 알림톡 시뮬레이션 실패', providerResponse: { dryRun: true, dryRunPayload } };
    }
    if (r.includes('bounce') || r.endsWith('8888')) {
      return { success: false, resultCode: 'BOUNCED', errorMessage: 'DRY_RUN: 시뮬레이션 반송', providerResponse: { dryRun: true, dryRunPayload } };
    }
    return { success: true, resultCode: 'SUCCESS', messageId: `dry-${crypto.randomUUID()}`, providerResponse: { dryRun: true, dryRunPayload } };
  }

  async testConnection(): Promise<TestResult> {
    const bad = Object.entries(this.config).find(([, v]) => v.toLowerCase() === 'invalid');
    if (bad) return { connected: false, message: `DRY_RUN: ${bad[0]} 값이 유효하지 않습니다.` };
    return { connected: true, message: `DRY_RUN: ${this.provider} 연결 테스트 성공 (실제 호출 없음)` };
  }
}
