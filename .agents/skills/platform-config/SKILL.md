---
name: platform-config
description: 플랫폼 연동 설정(Phase 2 UI/API) 구현 가이드. 공급사 선택 시 CommonCode.configTemplate 기반 변수 가이드 표출, Textarea 일괄 입력(JSON / KEY=VALUE) 파싱, AES-256-GCM 암호화 저장, 마스킹 응답, 저장 전 연결 테스트를 구현할 때 이 스킬을 사용한다.
---

# 플랫폼 연동 설정 스킬 (Phase 2 — PRD §5.1)

## 목적
회원이 공급사 API Key를 쉽고 안전하게 등록·검증할 수 있게 한다. 어댑터 자체는 `adapter-pattern` 스킬을 참조한다.

---

## 화면 흐름

```
[공급사 드롭다운] ← CommonCode(category=PROVIDER, isActive=true) 조회
      │
      ▼
[변수 가이드 패널]  ← configTemplate(JSON) 파싱 → 필수/선택 필드, 기본값 표시
      │
      ▼
[Textarea 일괄 입력]  ── 파싱 ──▶ [필드별 입력폼 자동 채움 + 누락 필드 하이라이트]
      │
      ▼
[연결 테스트] → POST /api/platform-configs/test (저장 없이 adapter.testConnection)
      │ 성공
      ▼
[저장] → POST /api/platform-configs (암호화 저장, status=ACTIVE)
```

## Textarea 일괄 입력 파서

`src/lib/parsers/configTextParser.ts` — 프론트/백엔드 공용 순수 함수로 작성한다.

```typescript
export type ParsedConfig = Record<string, string>;

/** JSON 또는 KEY=VALUE(줄 단위) 텍스트를 파싱한다. 키는 camelCase로 정규화. */
export function parseConfigText(raw: string): ParsedConfig {
  const text = raw.trim();
  if (text.startsWith('{')) {
    const obj: unknown = JSON.parse(text);
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new Error('JSON 객체 형식이 아닙니다.');
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamelCase(k), String(v)]),
    );
  }
  const result: ParsedConfig = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.search(/[=:]/);
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    result[toCamelCase(key)] = value;
  }
  return result;
}

/** API_KEY / api-key / ApiKey → apiKey */
export function toCamelCase(key: string): string {
  const parts = key.toLowerCase().split(/[_\-\s]+/).filter(Boolean);
  return parts
    .map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1)))
    .join('');
}
```

- 파싱 후 `configTemplate`의 키 목록과 대조하여 **누락된 required 필드**와 **알 수 없는 키**를 각각 경고로 표시한다.
- 파서는 반드시 단위 테스트를 작성한다 (JSON, KEY=VALUE, `KEY: VALUE`, 따옴표, 주석, 빈 줄).

## 암호화 저장 / 마스킹

- 암호화 대상 필드 판정: 키 이름이 `/(secret|key|token|password)/i`에 매칭되면 암호화한다 (`senderAddress`, `senderNumber`, `region`, `accountId`, `optOutNumber` 등은 평문).
- `src/lib/encryption.ts`: `encrypt(plain): string` → `iv:authTag:ciphertext` (hex), IV 12바이트(GCM 권장).
- GET 응답에서는 암호화 필드를 `****` + 원문 끝 4자리로 마스킹한다. **복호화 원문은 절대 응답에 포함하지 않는다.**
- 수정(PUT) 시 마스킹 값(`****`로 시작)이 그대로 넘어오면 기존 암호문을 유지한다.

## API Routes

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/platform-configs` | 회원의 설정 목록 (마스킹) |
| POST | `/api/platform-configs` | 신규 저장 (Zod 검증 → 암호화 → upsert) |
| PUT | `/api/platform-configs/[id]` | 수정 (`userId` 소유권 확인 필수) |
| DELETE | `/api/platform-configs/[id]` | 삭제 |
| POST | `/api/platform-configs/test` | 저장 없이 연결 테스트 (평문 입력 → adapter.testConnection) |
| POST | `/api/platform-configs/[id]/test` | 저장된 설정으로 테스트 → `status` 갱신 (ACTIVE/ERROR) |
| GET | `/api/common-codes?category=PROVIDER` | 공급사 목록 + configTemplate |

- `isDefault: true` 저장 시 같은 `userId + channel`의 다른 문서는 `isDefault: false`로 일괄 갱신한다.

## 완료 조건

- [ ] JSON / KEY=VALUE 붙여넣기 → 필드 자동 채움 + 누락 경고
- [ ] 저장된 문서의 비밀 필드가 DB에 암호문으로 저장됨 (mongosh로 확인)
- [ ] GET 응답에 평문 비밀값이 없음
- [ ] 연결 테스트 성공/실패 메시지 표출, 저장 설정의 `status` 반영
- [ ] 다른 회원의 설정 id로 PUT/DELETE 시 404
