---
name: contacts-import
description: 연락처 허브(Phase 3) 구현 가이드. 엑셀/CSV/TSV/TXT 드래그앤드롭 업로드, 상위 3행 미리보기, 동적 컬럼 매핑(이름 1개, 전화/이메일 복수), 전화번호·이메일 정규화, 중복 처리(overwrite/skip/create_new), UploadHistory 기록, Master-Detail 연락처 뷰어와 검색/필터를 구현할 때 이 스킬을 사용한다.
---

# 연락처 업로드 & 허브 스킬 (Phase 3 — PRD §5.2, §5.3)

## 목적
형식에 구애받지 않는 연락처 파일을 사용자 매핑으로 `Contact` 문서화하고, Master-Detail 뷰로 탐색·관리한다.

---

## 업로드 2단계 흐름 (stateless — harness-decisions #15)

```
1) POST /api/contacts/upload/preview   (multipart: file)
   → 파일 파싱 → { headers, sampleRows (상위 3행), totalRows, suggestion(매핑 추천) }  ※ 저장하지 않음

2) POST /api/contacts/upload/commit    (multipart: file + options(JSON: mappedColumns, duplicateHandling, labels[]))
   → 같은 파일을 다시 파싱 → 정규화 → 중복 처리 → bulkWrite → UploadHistory 집계(COMPLETED/FAILED)
```

## 파일 파서 — `src/lib/parsers/fileParser.ts`

| 확장자 | 라이브러리 | 비고 |
|---|---|---|
| `.xlsx`, `.xls` | `xlsx` | 첫 시트 사용, `sheet_to_json(ws, { header: 1, defval: '' })` |
| `.csv` | `papaparse` | BOM 제거, `skipEmptyLines: true` |
| `.tsv` | `papaparse` | `delimiter: '\t'` |
| `.txt` | `papaparse` | `delimiter` 자동 감지(쉼표/탭/세미콜론/파이프) |

- 한글 CSV 인코딩: UTF-8 디코딩 결과에 `�`가 다수 포함되면 `TextDecoder('euc-kr')`로 재디코딩한다 (엑셀에서 저장한 CP949 CSV 대응).
- 첫 행을 헤더로 간주. 헤더가 비어 있으면 `컬럼 1`, `컬럼 2`… 로 자동 명명.
- 업로드 크기 제한(예: 10MB)과 행 수 제한(예: 50,000행)을 두고 초과 시 400.

## 컬럼 매핑 규칙

```typescript
interface MappedColumns {
  name: string;          // 필수, 1개
  phones: string[];      // 0..N
  emails: string[];      // 0..N
  company?: string;
  department?: string;
  notes?: string;
  custom?: Record<string, string>;  // { 필드명: 원본헤더 } → customFields 로 저장
}
```
- `phones`와 `emails` 둘 다 비어 있으면 매핑 거부 (발송 불가 연락처).
- 헤더명 기반 **자동 추천**: `/이름|성명|name/i`, `/전화|연락처|휴대|mobile|phone|tel/i`, `/메일|e-?mail/i`, `/회사|company/i`, `/부서|직책|department|title/i`.

## 정규화 — `src/lib/validators/contactNormalizer.ts`

- **전화번호**: 숫자만 추출 → `+82` / `82` 접두는 `0`으로 치환 → 한국 번호 패턴 검증 → **저장 형식은 하이픈 없는 숫자열**(`01012345678`). 표시할 때만 하이픈 포맷.
  - 한 셀에 여러 번호가 `,` `/` `;` 줄바꿈으로 구분된 경우 분리.
- **이메일**: trim + 소문자화 + Zod `z.string().email()` 검증. 한 셀 다중 값 분리 동일.
- 각 연락처 내부에서 phones/emails 중복 제거.
- 유효하지 않은 값은 버리고 `skippedRows` / 경고 목록에 기록. 이름이 비었거나 유효 연락수단이 0개인 행은 skip.

## 중복 처리

중복 판정 키: 같은 `userId` 안에서 **정규화된 전화번호 또는 이메일이 하나라도 일치**하는 기존 Contact.

| 옵션 | 동작 |
|---|---|
| `skip` (기본) | 기존 문서 유지, 행 건너뜀 |
| `overwrite` | 기존 문서의 필드를 덮어쓰되 phones/emails/labels는 **합집합**, 수신거부 상태는 **절대 초기화하지 않음** |
| `create_new` | 무조건 신규 문서 생성 |

- 대량 처리: 기존 연락처 조회는 `$in` 배치(예: 1,000건 단위)로, 쓰기는 `bulkWrite`로 수행한다.
- 모든 신규/수정 문서에 `uploadBatchId`, `sourceName`(원본 파일명)을 기록한다.

## Master-Detail 뷰어 (PRD §5.3)

- **Master**: 이름 / 대표번호(phones[0]) / 대표이메일(emails[0]) / 출처 파일명 / 수신거부 뱃지. 커서 기반 페이지네이션(`_id` 기준).
- 검색: 이름·회사·부서·라벨은 이스케이프한 정규식 부분 일치 (harness-decisions #16), 번호는 숫자만 추출해 `phones` 부분 일치, 이메일은 `emails` 부분 일치.
- 필터: 출처(`sourceName` distinct), 라벨(`labels` distinct), 수신거부 제외 토글.
- **Detail 패널**: 모든 phones/emails(개별 수신거부 상태 표시), labels 편집, notes, customFields, **발송 이력 타임라인**(`DispatchLog.find({ userId, contactId }).sort({ sentAt: -1 })`), 수신거부 수동 토글(사유 `MANUAL`).

## API Routes

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/contacts/upload/preview` | 파싱 + 샘플 3행 |
| POST | `/api/contacts/upload/commit` | 매핑 확정 + 적재 |
| GET | `/api/contacts` | 목록 (cursor, q, sourceName[], labels[], excludeUnsubscribed) |
| GET | `/api/contacts/[id]` | 상세 |
| PATCH | `/api/contacts/[id]` | 수정 / 수신거부 토글 |
| GET | `/api/contacts/[id]/logs` | 발송 이력 |
| GET | `/api/contacts/facets` | sourceName/labels distinct 목록 |
| GET | `/api/uploads` | 업로드 이력 |

## 완료 조건

- [ ] `.xlsx`, `.xls`, `.csv`(UTF-8 / CP949), `.tsv`, `.txt` 샘플 파일 각각 업로드 성공
- [ ] 전화 컬럼 2개 + 이메일 컬럼 2개 매핑 시 배열로 저장
- [ ] 중복 3옵션 동작 확인, overwrite 시 수신거부 상태 보존
- [ ] UploadHistory의 total/imported/skipped 수치 일치
- [ ] Master 검색·필터·페이지네이션, Detail 타임라인·수신거부 토글 동작
- [ ] 정규화/파서 단위 테스트 통과
- [ ] Playwright headless E2E `e2e/phase3-contacts.spec.ts` 통과 (`e2e-playwright` 스킬 §6 필수 시나리오)
