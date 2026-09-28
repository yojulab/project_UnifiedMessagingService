---
name: adapter-pattern
description: Provider Adapter Pattern 구현 가이드. IMessagingAdapter 인터페이스 정의, 이메일(Zoho/SES) 및 SMS(알리고/솔라피) 어댑터 클래스 구현, AdapterFactory 팩토리 패턴, 새 공급사 추가 절차를 참조할 때 이 스킬을 사용한다.
---

# Provider Adapter Pattern 구현 스킬 (Phase 2)

## 목적
공급사 독립적인 메시징 어댑터 아키텍처를 구현한다. 어떤 SMS/Email 플랫폼이든 인터페이스만 구현하면 모듈식으로 추가·교체할 수 있도록 한다.

---

## 핵심 인터페이스

```typescript
// src/lib/adapters/IMessagingAdapter.ts

export interface SendPayload {
  recipient: string;           // 수신 번호 또는 이메일
  subject?: string;            // 이메일 제목 (SMS인 경우 null)
  body: string;                // 메시지 본문
  isHtml?: boolean;            // HTML 여부 (이메일)
  senderAddress?: string;      // 발신자 (이메일/번호)
  variables?: Record<string, string>;  // 치환 변수 ({name} 등)
  unsubscribeUrl?: string;     // 수신거부 링크 (이메일)
  unsubscribePhone?: string;   // 080 수신거부 번호 (SMS)
}

export interface SendResult {
  success: boolean;
  messageId?: string;          // 공급사 메시지 ID
  resultCode: 'SUCCESS' | 'FAILED' | 'BOUNCED';
  errorMessage?: string;
  providerResponse?: any;      // 원본 응답 보존
  unitCost?: number;           // 건당 비용 (원)
}

export interface TestResult {
  connected: boolean;
  message: string;
  providerInfo?: Record<string, any>;
}

export interface IMessagingAdapter {
  readonly channel: 'EMAIL' | 'SMS' | 'LMS' | 'KAKAO';
  readonly provider: string;

  /**
   * 메시지 발송
   */
  send(payload: SendPayload): Promise<SendResult>;

  /**
   * 연결 테스트 (Ping / Test Send)
   */
  testConnection(config: Record<string, any>): Promise<TestResult>;

  /**
   * 수신거부 푸터 생성 (선택 구현)
   */
  formatUnsubscribeFooter?(contactId: string, token: string): string;
}
```

## AdapterFactory (팩토리 패턴)

```typescript
// src/lib/adapters/AdapterFactory.ts

import { IMessagingAdapter } from './IMessagingAdapter';
import { ZohoAdapter } from './email/ZohoAdapter';
import { SesAdapter } from './email/SesAdapter';
import { AligoAdapter } from './sms/AligoAdapter';
import { SolapiAdapter } from './sms/SolapiAdapter';

const adapterRegistry: Record<string, new (config: any) => IMessagingAdapter> = {
  'EMAIL:ZOHO':    ZohoAdapter,
  'EMAIL:AWS_SES': SesAdapter,
  'SMS:ALIGO':     AligoAdapter,
  'SMS:SOLAPI':    SolapiAdapter,
  'LMS:ALIGO':     AligoAdapter,
  'LMS:SOLAPI':    SolapiAdapter,
};

export class AdapterFactory {
  static create(channel: string, provider: string, decryptedConfig: Record<string, any>): IMessagingAdapter {
    const key = `${channel}:${provider}`;
    const AdapterClass = adapterRegistry[key];
    if (!AdapterClass) {
      throw new Error(`지원되지 않는 어댑터: ${key}`);
    }
    return new AdapterClass(decryptedConfig);
  }

  static isSupported(channel: string, provider: string): boolean {
    return `${channel}:${provider}` in adapterRegistry;
  }
}
```

## 어댑터 구현 가이드

### 이메일 어댑터 (예: Zoho)

```typescript
// src/lib/adapters/email/ZohoAdapter.ts
export class ZohoAdapter implements IMessagingAdapter {
  readonly channel = 'EMAIL' as const;
  readonly provider = 'ZOHO';
  private config: ZohoConfig;

  constructor(config: Record<string, any>) {
    this.config = config as ZohoConfig;
  }

  async send(payload: SendPayload): Promise<SendResult> {
    // 1. OAuth refresh token으로 access token 획득
    // 2. Zoho Mail REST API 호출 (/api/accounts/{accountId}/messages)
    // 3. List-Unsubscribe 헤더 추가 (RFC 8058)
    // 4. 결과 매핑하여 SendResult 반환
  }

  async testConnection(config: Record<string, any>): Promise<TestResult> {
    // Zoho API에 인증 테스트 요청
  }

  formatUnsubscribeFooter(contactId: string, token: string): string {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/unsubscribe?token=${token}`;
    return `<br/><hr/><p style="font-size:12px;color:#888;">수신을 원하지 않으시면 <a href="${url}">여기를 클릭</a>하여 수신거부 하실 수 있습니다.</p>`;
  }
}
```

### SMS 어댑터 (예: 알리고)

```typescript
// src/lib/adapters/sms/AligoAdapter.ts
export class AligoAdapter implements IMessagingAdapter {
  readonly channel = 'SMS' as const;
  readonly provider = 'ALIGO';

  async send(payload: SendPayload): Promise<SendResult> {
    // 1. 080 수신거부 번호 본문 하단 자동 삽입
    // 2. 알리고 REST API 호출
    // 3. SMS/LMS 자동 판별 (본문 길이 기준: 90byte 이하 SMS, 초과 LMS)
  }

  async testConnection(config: Record<string, any>): Promise<TestResult> {
    // 알리고 잔액 조회 API로 연결 테스트
  }
}
```

## 새 공급사 추가 절차

1. `src/lib/adapters/{channel}/{ProviderName}Adapter.ts` 클래스 생성 (IMessagingAdapter 구현)
2. `AdapterFactory.ts`의 `adapterRegistry`에 `{CHANNEL}:{PROVIDER}` 키로 등록
3. `seeds/commonCodes.ts`에 해당 PROVIDER 코드 및 `configTemplate` 추가
4. DB에 시드 반영 (`CommonCode` 컬렉션)
5. (선택) 플랫폼 설정 UI에 공급사별 아이콘/설명 추가

## Fallback 정책

- **카카오 알림톡 → LMS 자동 전환**: 카카오 어댑터에서 발송 실패 시, 같은 `configData`의 SMS 어댑터로 재시도한다.
- Fallback 로직은 발송 엔진(dispatch 서비스 레이어)에서 처리하며, 어댑터 자체는 단일 책임만 가진다.

## 완료 조건

- [ ] Playwright headless E2E `e2e/phase2-platform.spec.ts` 통과 (`e2e-playwright` 스킬 §6 필수 시나리오)
