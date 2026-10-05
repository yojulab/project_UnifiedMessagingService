'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { MessagePreview, type Sample } from '@/components/campaigns/MessagePreview';
import { Stepper } from '@/components/campaigns/Stepper';
import { Button } from '@/components/ui/Button';
import { Checkbox, Radio, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Alert, PageHeader, Spinner, Stat } from '@/components/ui/Feedback';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { api, errMsg } from '@/lib/client/api';
import { CHANNEL_LABEL, fmtNum, fmtWon } from '@/lib/client/format';
import { SMS_MAX_BYTES, optOutLine, smsByteLength } from '@/lib/dispatch/template';
import type { TargetFilter } from '@/types';

interface Platform { id: string; name: string; channel: string; provider: string; providerName: string; isDefault: boolean; status: string; configData: Record<string, string> }
interface Estimate {
  channel: string; targetCount: number; messageCount: number; blockedCount: number; unitCost: number; estimatedCost: number; billedType: string; warnings: string[];
  sample: Sample | null; sampleError: string | null;
}
type Group = 'EMAIL' | 'SMS' | 'KAKAO';

const GROUPS: { value: Group; label: string; channels: string[] }[] = [
  { value: 'EMAIL', label: '이메일', channels: ['EMAIL'] },
  { value: 'SMS', label: '문자 (SMS / LMS)', channels: ['SMS', 'LMS'] },
  { value: 'KAKAO', label: '카카오 알림톡', channels: ['KAKAO'] },
];
const STEPS = ['채널 & 플랫폼', '발송 대상', '메시지 작성', '검토 & 발송'];

export default function NewCampaignPage(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [platforms, setPlatforms] = useState<Platform[] | null>(null);
  const [facets, setFacets] = useState<{ sourceNames: string[]; labels: string[] }>({ sourceNames: [], labels: [] });
  const [group, setGroup] = useState<Group>('EMAIL');
  const [chosenPlatformId, setPlatformId] = useState('');
  const [fallback, setFallback] = useState(false);
  const [fallbackId, setFallbackId] = useState('');
  const [filter, setFilter] = useState<TargetFilter>({ mode: 'ALL', limit: null, sort: 'createdAt_desc', labels: [], sourceNames: [], keywords: '' });
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isHtml, setIsHtml] = useState(false);
  const [isAd, setIsAd] = useState(true);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    Promise.all([api<Platform[]>('/api/platform-configs?status=ACTIVE'), api<{ sourceNames: string[]; labels: string[] }>('/api/contacts/facets')])
      .then(([p, f]) => { setPlatforms(p); setFacets(f); })
      .catch((e: unknown) => setError(errMsg(e)));
  }, []);

  const groupPlatforms = useMemo(() => (platforms ?? []).filter((p) => GROUPS.find((g) => g.value === group)?.channels.includes(p.channel)), [platforms, group]);
  const smsPlatforms = useMemo(() => (platforms ?? []).filter((p) => p.channel === 'SMS' || p.channel === 'LMS'), [platforms]);
  const platformId = groupPlatforms.some((p) => p.id === chosenPlatformId)
    ? chosenPlatformId
    : ((groupPlatforms.find((p) => p.isDefault) ?? groupPlatforms[0])?.id ?? '');
  const platform = groupPlatforms.find((p) => p.id === platformId);

  // 견적 (디바운스)
  useEffect(() => {
    if (step < 2 || !platformId) return;
    if (filter.mode !== 'ALL' && !filter.limit) return;
    const t = setTimeout(() => {
      setEstimating(true);
      api<Estimate>('/api/campaigns/estimate', {
        method: 'POST',
        json: { platformConfigId: platformId, targetFilter: filter, messageTemplate: { subject, body: body || undefined, isHtml, isAd } },
      })
        .then((e) => { setEstimate(e); setError(null); })
        .catch((e: unknown) => setError(errMsg(e)))
        .finally(() => setEstimating(false));
    }, 400);
    return () => clearTimeout(t);
  }, [step, platformId, filter, subject, body, isHtml, isAd]);

  const channel = platform?.channel ?? group;
  const isSms = channel === 'SMS' || channel === 'LMS';
  const optOut = platform?.configData.optOutNumber;
  const composedLen = smsByteLength(`${isAd ? '(광고) ' : ''}${body}${isAd && optOut ? `\n${optOutLine(optOut)}` : ''}`);

  const canNext =
    step === 1 ? Boolean(platformId) && (!fallback || Boolean(fallbackId))
    : step === 2 ? (filter.mode === 'ALL' || Boolean(filter.limit)) && (estimate?.messageCount ?? 0) > 0
    : step === 3 ? Boolean(name.trim() && body.trim() && (channel !== 'EMAIL' || subject.trim()) && !(isSms && isAd && !optOut))
    : true;

  function insertTag(tag: string): void {
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + tag); return; }
    const { selectionStart: s, selectionEnd: e } = el;
    setBody((b) => b.slice(0, s) + tag + b.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tag.length, s + tag.length); });
  }

  async function send(): Promise<void> {
    setSending(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/api/campaigns', {
        method: 'POST',
        json: {
          campaignName: name,
          platformConfigId: platformId,
          fallbackToLms: channel === 'KAKAO' && fallback,
          fallbackConfigId: channel === 'KAKAO' && fallback ? fallbackId : null,
          targetFilter: filter,
          messageTemplate: { subject, body, isHtml, isAd },
          scheduledAt: when === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        },
      });
      router.push(`/analytics/campaigns/${r.id}`);
    } catch (err) {
      setError(errMsg(err));
      setSending(false);
    }
  }

  const summary = estimate && (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="발송 견적" data-ui-id="CMP-SEC-ESTIMATE">
      <Stat label="대상 고객 수" value={<span data-testid="target-count">{fmtNum(estimate.targetCount)}명</span>} />
      <Stat label="예상 발송 건수" value={<span data-testid="message-count">{fmtNum(estimate.messageCount)}건</span>} sub="다중 연락처 포함" />
      <Stat label="수신거부 제외" value={`${fmtNum(estimate.blockedCount)}건`} sub="번호·이메일 단위" />
      <Stat label="예상 비용" value={<span data-testid="estimated-cost">{fmtWon(estimate.estimatedCost)}</span>} sub={`${CHANNEL_LABEL[estimate.billedType]} 건당 ${fmtWon(estimate.unitCost)}`} />
    </div>
  );

  return (
    <div>
      <PageHeader title="새 캠페인" description="4단계로 메시지를 발송합니다." titleUiId="CMP-TIT-002" descUiId="CMP-TXT-002" />
      <Stepper steps={STEPS} current={step} />
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {!platforms && !error && <Spinner />}

      {platforms && step === 1 && (
        <section className="card space-y-5" aria-label="Step 1 채널 및 플랫폼 선택" data-ui-id="CMP-SEC-STEP1">
          <fieldset>
            <legend className="field-label">발송 채널</legend>
            <div className="flex flex-wrap gap-4">
              {GROUPS.map((g) => <Radio key={g.value} name="group" label={g.label} checked={group === g.value} onChange={() => { setGroup(g.value); setEstimate(null); }} />)}
            </div>
          </fieldset>
          {groupPlatforms.length === 0 ? (
            <Alert tone="warning">
              ⚠ 등록된 {GROUPS.find((g) => g.value === group)?.label} 플랫폼이 없습니다.{' '}
              <Link href="/platform-config" className="font-medium text-primary underline">플랫폼 설정 바로가기 →</Link>
            </Alert>
          ) : (
            <SelectField label="발송 플랫폼" value={platformId} onChange={(e) => setPlatformId(e.target.value)} data-ui-id="CMP-SEL-PLATFORM">
              {groupPlatforms.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({CHANNEL_LABEL[p.channel]} · {p.providerName}{p.configData.senderAddress ? ` · ${p.configData.senderAddress}` : p.configData.senderNumber ? ` · ${p.configData.senderNumber}` : ''}){p.isDefault ? ' — 기본' : ''}</option>
              ))}
            </SelectField>
          )}
          {group === 'KAKAO' && groupPlatforms.length > 0 && (
            <div className="space-y-3 rounded-md border border-border p-3" data-ui-id="CMP-SEC-FALLBACK">
              <Checkbox label="알림톡 발송 실패 시 LMS 로 자동 전환" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
              {fallback && (
                smsPlatforms.length === 0
                  ? <Alert tone="warning">대체 발송에 사용할 SMS/LMS 플랫폼이 없습니다.</Alert>
                  : (
                    <SelectField label="LMS 대체 플랫폼" value={fallbackId} onChange={(e) => setFallbackId(e.target.value)} data-ui-id="CMP-SEL-FALLBACK">
                      <option value="">선택하세요</option>
                      {smsPlatforms.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.providerName})</option>)}
                    </SelectField>
                  )
              )}
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="card space-y-5" aria-label="Step 2 발송 대상 설정" data-ui-id="CMP-SEC-STEP2">
          <fieldset>
            <legend className="field-label">타겟팅 모드</legend>
            <div className="flex flex-wrap gap-4">
              <Radio name="mode" label="전체 발송 (수신거부 제외)" checked={filter.mode === 'ALL'} onChange={() => setFilter({ ...filter, mode: 'ALL', limit: null })} />
              <Radio name="mode" label="상위 N명" checked={filter.mode === 'TOP_N'} onChange={() => setFilter({ ...filter, mode: 'TOP_N', limit: filter.limit ?? 10 })} />
              <Radio name="mode" label="무작위 N명" checked={filter.mode === 'RANDOM_N'} onChange={() => setFilter({ ...filter, mode: 'RANDOM_N', limit: filter.limit ?? 10 })} />
            </div>
          </fieldset>
          {filter.mode !== 'ALL' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="N (명)" type="number" min={1} value={filter.limit ?? ''} onChange={(e) => setFilter({ ...filter, limit: e.target.value ? Math.max(1, Number(e.target.value)) : null })} data-ui-id="CMP-INP-LIMIT" />
              {filter.mode === 'TOP_N' && (
                <SelectField label="정렬 기준" value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as TargetFilter['sort'] })} data-ui-id="CMP-SEL-SORT">
                  <option value="createdAt_desc">최신 등록순</option>
                  <option value="createdAt_asc">오래된 등록순</option>
                  <option value="name_asc">이름순</option>
                </SelectField>
              )}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <MultiSelect label="출처 파일" options={facets.sourceNames} value={filter.sourceNames ?? []} onChange={(v) => setFilter({ ...filter, sourceNames: v })} data-ui-id="CMP-SEL-SOURCES" />
            <MultiSelect label="라벨" options={facets.labels} value={filter.labels ?? []} onChange={(v) => setFilter({ ...filter, labels: v })} data-ui-id="CMP-SEL-LABELS" />
            <TextField label="키워드 (이름·회사·부서)" value={filter.keywords ?? ''} onChange={(e) => setFilter({ ...filter, keywords: e.target.value })} data-ui-id="CMP-INP-KEYWORDS" />
          </div>
          {estimating && !estimate && <Spinner label="대상 계산 중" />}
          {summary}
          {estimate?.warnings.map((w) => <Alert key={w} tone="warning">{w}</Alert>)}
          {estimate && estimate.messageCount === 0 && <Alert tone="warning">조건에 맞는 발송 대상이 없습니다.</Alert>}
        </section>
      )}

      {step === 3 && (
        <section className="card space-y-5" aria-label="Step 3 메시지 작성" data-ui-id="CMP-SEC-STEP3">
          <TextField label="캠페인명" required value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 10월 신제품 안내" data-ui-id="CMP-INP-NAME" />
          {channel === 'EMAIL' && <TextField label="이메일 제목" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="{name}님, 안녕하세요" data-ui-id="CMP-INP-SUBJECT" />}
          {channel === 'LMS' && <TextField label="LMS 제목 (선택)" value={subject} onChange={(e) => setSubject(e.target.value)} data-ui-id="CMP-INP-SUBJECT" />}
          <div>
            <TextAreaField
              ref={bodyRef}
              label="본문"
              required
              rows={channel === 'EMAIL' ? 10 : 6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'{name}님 안녕하세요,\n\n...메시지 내용...'}
              data-ui-id="CMP-INP-BODY"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">치환 태그:</span>
              {['{name}', '{company}', '{department}'].map((t) => <Button key={t} size="sm" variant="secondary" onClick={() => insertTag(t)}>{t}</Button>)}
              {isSms && <span className={`ml-auto tabular-nums ${composedLen > SMS_MAX_BYTES ? 'text-warning' : 'text-muted-foreground'}`}>{composedLen} / {SMS_MAX_BYTES} byte {composedLen > SMS_MAX_BYTES && channel === 'SMS' ? '→ LMS 로 자동 전환' : ''}</span>}
            </div>
          </div>
          {channel === 'EMAIL' && <Checkbox label="HTML 본문" checked={isHtml} onChange={(e) => setIsHtml(e.target.checked)} />}
          {channel === 'EMAIL' && <Checkbox label="광고성 메일 (제목 앞 (광고) 표기 + 발신자 정보 표기)" checked={isAd} onChange={(e) => setIsAd(e.target.checked)} />}
          {isSms && <Checkbox label="광고성 메시지 ((광고) 표기 + 080 수신거부 자동 삽입)" checked={isAd} onChange={(e) => setIsAd(e.target.checked)} />}
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 text-sm" aria-label="자동 삽입 영역" data-ui-id="CMP-SEC-AUTO-INSERT">
            <p className="font-medium">⚡ 자동 삽입 영역</p>
            {channel === 'EMAIL' && isAd && <p className="mt-1 text-xs">광고성 메일: 제목 앞 <strong>(광고)</strong> 표기와 발신자 명칭·주소가 자동으로 들어갑니다 (정보통신망법).</p>}
            {channel === 'EMAIL' && platform?.provider !== 'ZOHO' && <p className="mt-1 text-xs">본문 하단 수신거부 링크 + RFC 8058 List-Unsubscribe / List-Unsubscribe-Post 헤더가 수신자별로 자동 부착됩니다.</p>}
            {channel === 'EMAIL' && platform?.provider === 'ZOHO' && (
              <p className="mt-1 text-xs text-warning" role="alert">
                본문 하단 수신거부 링크만 자동 삽입됩니다. Zoho Mail API 는 사용자 정의 헤더를 지원하지 않아 RFC 8058 원클릭 수신거부 헤더가 붙지 않습니다 — Gmail·Yahoo 대량 발송 요건상 광고 메일은 AWS SES 사용을 권장합니다.
              </p>
            )}
            {isSms && isAd && (optOut
              ? <p className="mt-1 font-mono text-xs" data-testid="optout-line">{optOutLine(optOut)}</p>
              : <p className="mt-1 text-xs text-danger">선택한 플랫폼에 080 수신거부 번호가 없습니다. <Link href="/platform-config" className="underline">플랫폼 설정</Link>에서 등록하세요.</p>)}
            {isSms && !isAd && <p className="mt-1 text-xs">정보성 메시지는 수신거부 문구를 삽입하지 않습니다.</p>}
            {channel === 'KAKAO' && <p className="mt-1 text-xs">알림톡은 승인된 템플릿과 동일한 본문만 발송됩니다.</p>}
          </div>
          {estimate?.sample && body && <MessagePreview sample={estimate.sample} channel={channel} />}
          {estimate?.sampleError && <Alert tone="error">{estimate.sampleError}</Alert>}
        </section>
      )}

      {step === 4 && estimate && (
        <section className="card space-y-5" aria-label="Step 4 최종 검토" data-ui-id="CMP-SEC-STEP4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto,1fr]" data-ui-id="CMP-SEC-SUMMARY">
            <dt className="text-muted-foreground">캠페인</dt><dd className="font-medium">{name}</dd>
            <dt className="text-muted-foreground">채널</dt><dd>{CHANNEL_LABEL[channel]} ({platform?.name}){fallback && channel === 'KAKAO' ? ' · 실패 시 LMS 대체' : ''}</dd>
            <dt className="text-muted-foreground">대상</dt><dd>{fmtNum(estimate.targetCount)}명 → {fmtNum(estimate.messageCount)}건 발송</dd>
            <dt className="text-muted-foreground">모드</dt><dd>{{ ALL: '전체 발송', TOP_N: `상위 ${filter.limit}명`, RANDOM_N: `무작위 ${filter.limit}명` }[filter.mode]}</dd>
            <dt className="text-muted-foreground">필터</dt>
            <dd>{[filter.labels?.length ? `라벨 ${filter.labels.join(', ')}` : '', filter.sourceNames?.length ? `출처 ${filter.sourceNames.join(', ')}` : '', filter.keywords ? `키워드 "${filter.keywords}"` : ''].filter(Boolean).join(' · ') || '없음'}</dd>
            <dt className="text-muted-foreground">예상 비용</dt><dd>{fmtWon(estimate.estimatedCost)}</dd>
          </dl>
          {estimate.warnings.map((w) => <Alert key={w} tone="error">{w}</Alert>)}
          {estimate.sample && <MessagePreview sample={estimate.sample} channel={channel} />}
          <fieldset>
            <legend className="field-label">발송 시점</legend>
            <div className="flex flex-wrap items-center gap-4">
              <Radio name="when" label="즉시 발송" checked={when === 'now'} onChange={() => setWhen('now')} />
              <Radio name="when" label="예약 발송" checked={when === 'later'} onChange={() => setWhen('later')} />
              {when === 'later' && <TextField label="예약 일시" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} wrapClassName="min-w-[220px]" data-ui-id="CMP-INP-SCHEDULED" />}
            </div>
          </fieldset>
        </section>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {step > 1 && <Button data-ui-id="CMP-BTN-PREV" variant="secondary" onClick={() => setStep(step - 1)}>← 이전</Button>}
          <Link href="/campaigns" data-ui-id="CMP-BTN-CANCEL" className="rounded-md px-4 py-2 text-sm hover:bg-muted">취소</Link>
        </div>
        {step < 4 ? (
          <Button data-ui-id="CMP-BTN-NEXT" onClick={() => setStep(step + 1)} disabled={!canNext || (step === 2 && estimating)}>다음 →</Button>
        ) : (
          <Button data-ui-id="CMP-BTN-SUBMIT" onClick={() => void send()} loading={sending} disabled={when === 'later' && !scheduledAt}>
            {when === 'later' ? '예약 발송' : '🚀 발송'}
          </Button>
        )}
      </div>
    </div>
  );
}
