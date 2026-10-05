'use client';

import { useEffect, useState, type ReactElement } from 'react';

/**
 * 의뢰자 소통용 UI 식별 태그(data-ui-id) 인스펙터 오버레이
 *
 * - 개발 환경 또는 NEXT_PUBLIC_ENABLE_INSPECTOR=true 일 때만 렌더링됩니다.
 * - 프로덕션 환경에서는 null 을 반환하여 DOM 및 번들 오버헤드가 전혀 없습니다.
 * - 단축키: Alt + U (또는 Ctrl + Shift + U)
 * - 활성화 시: body 에 .show-ui-tags 클래스가 토글되며, 태그 클릭 시 data-ui-id 를 클립보드에 복사합니다.
 */
export function UiInspectorOverlay(): ReactElement | null {
  const [enabled, setEnabled] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 운영 환경 비노출: NODE_ENV 가 production 이고 명시적 검토 환경 변수가 없으면 렌더링 차단
  const isEnabledEnv =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_INSPECTOR === 'true';

  useEffect(() => {
    if (!isEnabledEnv) return;

    // 단축키 리스너 (Alt + U 또는 Ctrl + Shift + U)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.altKey && e.key.toLowerCase() === 'u') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'u')) {
        e.preventDefault();
        setEnabled((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEnabledEnv]);

  useEffect(() => {
    if (!isEnabledEnv) return;

    if (enabled) {
      document.body.classList.add('show-ui-tags');
    } else {
      document.body.classList.remove('show-ui-tags');
    }

    return () => {
      document.body.classList.remove('show-ui-tags');
    };
  }, [enabled, isEnabledEnv]);

  // UI 태그 클릭 시 ID 클립보드 복사 이벤트
  useEffect(() => {
    if (!isEnabledEnv || !enabled) return;

    const handleClick = (e: MouseEvent): void => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-ui-id]');
      if (!target) return;

      const uiId = target.getAttribute('data-ui-id');
      if (uiId && e.altKey) {
        // Alt + 클릭 시 기본 동작 대신 ID 복사
        e.preventDefault();
        e.stopPropagation();
        void navigator.clipboard.writeText(uiId).then(() => {
          setCopiedId(uiId);
          setTimeout(() => setCopiedId(null), 2000);
        });
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [enabled, isEnabledEnv]);

  if (!isEnabledEnv) {
    return null;
  }

  return (
    <aside
      aria-label="UI 검토 인스펙터"
      className="fixed bottom-4 right-4 z-[99999] flex flex-col items-end gap-1.5 font-sans"
    >
      {copiedId && (
        <div className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-lg animate-fade-in">
          복사 완료: <code className="font-mono">{copiedId}</code>
        </div>
      )}
      <button
        type="button"
        data-ui-id="COM-BTN-INSPECTOR"
        onClick={() => setEnabled((prev) => !prev)}
        title="단축키: Alt + U (요소 Alt+클릭 시 ID 복사)"
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-xl transition-all ${
          enabled
            ? 'bg-violet-600 text-white ring-2 ring-violet-300 dark:ring-violet-800'
            : 'border border-border bg-surface/90 text-foreground backdrop-blur hover:bg-muted'
        }`}
      >
        <span aria-hidden>{enabled ? '🏷️' : '🏷️'}</span>
        <span>{enabled ? 'UI 태그 숨김' : 'UI 태그 보기'}</span>
        <kbd className="ml-1 rounded bg-black/20 px-1 py-0.5 text-[10px] font-mono uppercase opacity-75">
          Alt+U
        </kbd>
      </button>
    </aside>
  );
}
