'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useApiData } from '@/lib/client/useApiData';
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel';
import type { ContactListItem } from '@/components/contacts/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Alert, EmptyState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { api, errMsg, qs } from '@/lib/client/api';
import { fmtNum } from '@/lib/client/format';

interface ListResponse { items: ContactListItem[]; total: number; nextCursor: string | null }
interface Facets { sourceNames: string[]; labels: string[] }

export default function ContactsPage(): ReactElement {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [unsub, setUnsub] = useState<'all' | 'exclude' | 'only'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useCallback(
    (c: string | null) => api<ListResponse>(`/api/contacts${qs({ q: debouncedQ, sourceName: sources, label: labels, unsub: unsub === 'all' ? null : unsub, cursor: c })}`),
    [debouncedQ, sources, labels, unsub],
  );

  const loader = useCallback(() => Promise.all([query(null), api<Facets>('/api/contacts/facets')]), [query]);
  const { data, error: loadError, reload, setData } = useApiData(loader);
  const items = data?.[0].items ?? null;
  const total = data?.[0].total ?? 0;
  const cursor = data?.[0].nextCursor ?? null;
  const facets = data?.[1] ?? { sourceNames: [], labels: [] };
  const error = loadError ?? moreError;

  async function more(): Promise<void> {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const r = await query(cursor);
      setData((prev) => (prev ? [{ ...r, items: [...prev[0].items, ...r.items] }, prev[1]] : prev));
      setMoreError(null);
    } catch (err) {
      setMoreError(errMsg(err));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="연락처 관리"
        description={`총 ${fmtNum(total)}명`}
        actions={
          <>
            <Link href="/analytics/unsubscribes" className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted">수신거부 관리</Link>
            <Link href="/contacts/upload" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">파일 업로드</Link>
          </>
        }
      />
      <div className="card mb-4 grid gap-3 md:grid-cols-4" role="search" aria-label="연락처 검색 및 필터">
        <TextField label="검색" placeholder="이름, 번호, 이메일, 회사" value={q} onChange={(e) => setQ(e.target.value)} />
        <MultiSelect label="출처 파일" options={facets.sourceNames} value={sources} onChange={setSources} />
        <MultiSelect label="라벨" options={facets.labels} value={labels} onChange={setLabels} />
        <SelectField label="수신거부" value={unsub} onChange={(e) => setUnsub(e.target.value as typeof unsub)}>
          <option value="all">전체 보기</option>
          <option value="exclude">전체 수신거부 제외</option>
          <option value="only">수신거부 연락처만</option>
        </SelectField>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className={`grid gap-4 ${selected ? 'lg:grid-cols-[minmax(0,1fr),420px]' : ''}`}>
        <div className="card overflow-hidden p-0">
          {!items && <div className="p-4"><Skeleton rows={6} /></div>}
          {items && items.length === 0 && (
            <div className="p-4">
              <EmptyState title="연락처가 없습니다.">파일을 업로드하거나 필터 조건을 변경하세요.</EmptyState>
            </div>
          )}
          {items && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table-base" aria-label="연락처 목록">
                <thead>
                  <tr><th>이름</th><th>대표번호</th><th>대표이메일</th><th className="hidden xl:table-cell">출처</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      className={`cursor-pointer hover:bg-muted ${selected === c.id ? 'bg-primary/10' : ''}`}
                      aria-selected={selected === c.id}
                    >
                      <td>
                        <button type="button" className="text-left font-medium hover:underline" onClick={() => setSelected(c.id)}>{c.name}</button>
                        {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs">{c.primaryPhone || '-'}{c.phoneCount > 1 && <span className="ml-1 text-muted-foreground">+{c.phoneCount - 1}</span>}</td>
                      <td className="max-w-[200px] truncate text-xs">{c.primaryEmail || '-'}{c.emailCount > 1 && <span className="ml-1 text-muted-foreground">+{c.emailCount - 1}</span>}</td>
                      <td className="hidden max-w-[180px] truncate text-xs text-muted-foreground xl:table-cell">{c.sourceName}</td>
                      <td>{c.unsubscribe === 'ALL' ? <Badge tone="danger">수신거부</Badge> : c.unsubscribe === 'PARTIAL' ? <Badge tone="warning">일부거부</Badge> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cursor && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => void more()}>더 보기</Button>
            </div>
          )}
        </div>
        {selected && <ContactDetailPanel key={selected} id={selected} onChanged={() => void reload()} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
