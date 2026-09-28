---
name: db-schema
description: MongoDB Mongoose 스키마 정의 가이드. Users, CommonCodes, PlatformConfigs, Contacts, UploadHistories, DispatchJobs, DispatchLogs 7개 모델의 상세 필드 정의, 인덱스 전략, 관계 매핑을 참조할 때 이 스킬을 사용한다.
---

# DB 스키마 정의 스킬

## 목적
PRD §3에 명시된 MongoDB 컬렉션 스키마를 Mongoose 모델로 구현할 때 참조한다.

---

## 1. User 모델

```typescript
// src/lib/db/models/User.ts
const UserSchema = new Schema({
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:       { type: String, required: true },
  name:               { type: String, required: true, trim: true },
  company:            { type: String, default: '' },
  defaultSenderPhone: { type: String, default: '' },
  defaultSenderEmail: { type: String, default: '' },
  themePreference:    { type: String, enum: ['light', 'dark', 'system', 'blue', 'indigo', 'emerald', 'violet', 'rose', 'slate'], default: 'light' },
}, { timestamps: true });
```

## 2. CommonCode 모델

```typescript
// src/lib/db/models/CommonCode.ts
const CommonCodeSchema = new Schema({
  category:       { type: String, required: true, enum: ['MSG_CHANNEL', 'PROVIDER', 'DISPATCH_STATUS', 'UNSUB_REASON'] },
  code:           { type: String, required: true },
  name:           { type: String, required: true },
  sortOrder:      { type: Number, default: 0 },
  isActive:       { type: Boolean, default: true },
  configTemplate: { type: String, default: null },  // JSON string — 플랫폼별 필요 파라미터 정의
}, { timestamps: true });

CommonCodeSchema.index({ category: 1, code: 1 }, { unique: true });
```

## 3. PlatformConfig 모델

```typescript
// src/lib/db/models/PlatformConfig.ts
const PlatformConfigSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channel:  { type: String, required: true, enum: ['EMAIL', 'SMS', 'LMS', 'KAKAO'] },
  provider: { type: String, required: true },  // CommonCode의 PROVIDER 코드와 매핑
  configData: {
    type: Schema.Types.Mixed,  // AES-256-GCM 암호화된 키-값 쌍
    required: true,
  },
  isDefault: { type: Boolean, default: false },
  status:    { type: String, enum: ['ACTIVE', 'ERROR', 'PENDING'], default: 'PENDING' },
}, { timestamps: true });

PlatformConfigSchema.index({ userId: 1, channel: 1, provider: 1 }, { unique: true });
```

## 4. Contact 모델

```typescript
// src/lib/db/models/Contact.ts
const ContactSchema = new Schema({
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadBatchId: { type: Schema.Types.ObjectId, ref: 'UploadHistory', default: null },
  sourceName:    { type: String, default: '' },  // 원본 파일명
  name:          { type: String, required: true, trim: true },
  phones:        [{ type: String }],  // 다중 전화번호
  emails:        [{ type: String }],  // 다중 이메일
  company:       { type: String, default: '' },
  department:    { type: String, default: '' },
  labels:        [{ type: String }],  // 태그/그룹
  notes:         { type: String, default: '' },
  isUnsubscribed:      { type: Boolean, default: false },
  unsubscribedChannels: [{ type: String, enum: ['SMS', 'EMAIL', 'KAKAO'] }],
  unsubscribedAt:       { type: Date, default: null },
  customFields:  { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ContactSchema.index({ userId: 1, isUnsubscribed: 1 });
ContactSchema.index({ userId: 1, labels: 1 });
ContactSchema.index({ userId: 1, name: 'text', company: 'text' });  // 텍스트 검색
```

## 5. UploadHistory 모델

```typescript
// src/lib/db/models/UploadHistory.ts
const UploadHistorySchema = new Schema({
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
  originalFileName: { type: String, required: true },
  fileType:         { type: String, enum: ['xlsx', 'xls', 'csv', 'tsv', 'txt'] },
  totalRows:        { type: Number, default: 0 },
  importedRows:     { type: Number, default: 0 },
  skippedRows:      { type: Number, default: 0 },
  mappedColumns: {
    name:       { type: String },          // 매핑된 이름 컬럼
    phones:     [{ type: String }],        // 매핑된 전화번호 컬럼(복수)
    emails:     [{ type: String }],        // 매핑된 이메일 컬럼(복수)
    company:    { type: String },
    department: { type: String },
    notes:      { type: String },
    custom:     { type: Schema.Types.Mixed },
  },
  duplicateHandling: { type: String, enum: ['overwrite', 'skip', 'create_new'], default: 'skip' },
  status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'FAILED'], default: 'PROCESSING' },
}, { timestamps: true });

UploadHistorySchema.index({ userId: 1 });
```

## 6. DispatchJob 모델

```typescript
// src/lib/db/models/DispatchJob.ts
const DispatchJobSchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  campaignName: { type: String, required: true },
  channel:      { type: String, required: true, enum: ['EMAIL', 'SMS', 'LMS', 'KAKAO'] },
  provider:     { type: String, required: true },
  platformConfigId: { type: Schema.Types.ObjectId, ref: 'PlatformConfig' },
  targetFilter: {
    mode:       { type: String, enum: ['ALL', 'TOP_N', 'RANDOM_N'], default: 'ALL' },
    limit:      { type: Number, default: null },
    labels:     [{ type: String }],
    sourceNames: [{ type: String }],
    keywords:   { type: String, default: '' },
  },
  messageTemplate: {
    subject: { type: String, default: '' },  // 이메일 제목
    body:    { type: String, required: true },  // 본문 ({name} 등 치환태그 포함)
    isHtml:  { type: Boolean, default: false },
  },
  scheduledAt:      { type: Date, default: null },  // null이면 즉시 발송
  totalTargets:     { type: Number, default: 0 },   // 대상 고객 수
  totalMessages:    { type: Number, default: 0 },   // 예상 발송 건수 (다중 연락처 포함)
  sentCount:        { type: Number, default: 0 },
  failedCount:      { type: Number, default: 0 },
  status:           { type: String, enum: ['DRAFT', 'PENDING', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED'], default: 'DRAFT' },
}, { timestamps: true });

DispatchJobSchema.index({ userId: 1, status: 1 });
DispatchJobSchema.index({ userId: 1, createdAt: -1 });
```

## 7. DispatchLog 모델

```typescript
// src/lib/db/models/DispatchLog.ts
const DispatchLogSchema = new Schema({
  dispatchJobId: { type: Schema.Types.ObjectId, ref: 'DispatchJob', required: true },
  contactId:     { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channel:       { type: String, required: true },
  recipient:     { type: String, required: true },  // 실제 발송된 번호 또는 이메일
  resultCode:    { type: String, enum: ['SUCCESS', 'FAILED', 'BOUNCED', 'PENDING'], default: 'PENDING' },
  providerResponse: { type: Schema.Types.Mixed, default: {} },  // 공급사 원본 응답
  errorMessage:  { type: String, default: '' },
  unitCost:      { type: Number, default: 0 },  // 건당 과금 (원)
  sentAt:        { type: Date, default: null },
}, { timestamps: true });

DispatchLogSchema.index({ dispatchJobId: 1, resultCode: 1 });
DispatchLogSchema.index({ userId: 1, sentAt: -1 });
DispatchLogSchema.index({ contactId: 1 });
```

---

## 관계 다이어그램 요약

```
User (1) ──→ (N) PlatformConfig
User (1) ──→ (N) Contact
User (1) ──→ (N) UploadHistory
User (1) ──→ (N) DispatchJob

UploadHistory (1) ──→ (N) Contact (uploadBatchId)
DispatchJob (1) ──→ (N) DispatchLog
Contact (1) ──→ (N) DispatchLog
```
