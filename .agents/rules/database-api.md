# 데이터베이스 & API 규칙

## MongoDB 연결 정보

```
MONGODB_URI=mongodb://host.docker.internal:27017
MONGODB_DBNAME=UnifiedMessagingService_dev
```

## Mongoose 연결 패턴

Next.js의 HMR(Hot Module Replacement)에서 연결이 중복되지 않도록 **캐시된 싱글턴 패턴**을 반드시 사용한다:

```typescript
// src/lib/db/connection.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DBNAME,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
```

## 컬렉션 & 모델 매핑

| 컬렉션명 | 모델 파일 | 핵심 필드 |
|---|---|---|
| `users` | `User.ts` | email, passwordHash, name, company, themePreference |
| `commoncodes` | `CommonCode.ts` | category, code, name, configTemplate, sortOrder |
| `platformconfigs` | `PlatformConfig.ts` | userId, channel, provider, configData(encrypted), isDefault |
| `contacts` | `Contact.ts` | userId, name, phones[], emails[], labels[], isUnsubscribed |
| `uploadhistories` | `UploadHistory.ts` | userId, originalFileName, totalRows, mappedColumns |
| `dispatchjobs` | `DispatchJob.ts` | userId, campaignName, channel, provider, targetFilter, status |
| `dispatchlogs` | `DispatchLog.ts` | dispatchJobId, contactId, recipient, resultCode, errorMessage |

## 스키마 공통 규칙

1. **`timestamps: true`** — 모든 스키마에 적용 (createdAt / updatedAt 자동 생성).
2. **`userId` 필수** — `users` 컬렉션을 제외한 모든 컬렉션에 `userId: ObjectId (ref: 'User')` 필드 포함.
3. **인덱스 전략**:
   - `{ userId: 1 }` — 기본 테넌트 필터 인덱스 (모든 컬렉션)
   - `{ userId: 1, channel: 1, provider: 1 }` — PlatformConfigs 복합 인덱스
   - `{ userId: 1, isUnsubscribed: 1 }` — Contacts 수신거부 필터
   - `{ dispatchJobId: 1, resultCode: 1 }` — DispatchLogs 결과 조회

## API Route 규칙

- 모든 API Route에서 세션/JWT로 `userId`를 추출하고, 쿼리에 포함한다.
- 인증되지 않은 요청에는 `401 Unauthorized`를 반환한다.
- 입력 유효성 검사에 **Zod** 스키마를 사용한다.
- 대량 데이터 조회 시 **커서 기반 페이지네이션**을 적용한다.
- 응답 형식: `{ success: boolean, data?: T, error?: { code: string, message: string } }`

## 암호화 규칙

- `PlatformConfig.configData` 내의 `clientId`, `clientSecret`, `apiKey` 필드는 **저장 전 AES-256-GCM 암호화**, **사용 시 복호화**.
- 암호화 키는 `ENCRYPTION_KEY` 환경 변수에서 로드한다.
- **절대** 복호화된 API Key를 클라이언트에 노출하지 않는다. 프론트엔드에는 마스킹된 값(`****XXXX`)만 전송한다.
