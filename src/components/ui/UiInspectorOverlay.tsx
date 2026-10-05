'use client';

import { useEffect, useState, useCallback, useSyncExternalStore, type ReactElement } from 'react';

interface BadgeItem {
  id: string;
  top: number;
  left: number;
}

// ── 로컬 스토리지 및 전역 인스펙터 상태 관리 (React 19 useSyncExternalStore 호환) ──
const inspectorListeners = new Set<() => void>();

function notifyInspectorChange(): void {
  inspectorListeners.forEach((listener) => listener());
}

function subscribeInspector(callback: () => void): () => void {
  inspectorListeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    inspectorListeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function getInspectorSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('ui-inspector-enabled');
  return saved !== 'false';
}

function getServerSnapshot(): boolean {
  return false;
}

function toggleInspector(): void {
  const next = !getInspectorSnapshot();
  localStorage.setItem('ui-inspector-enabled', String(next));
  notifyInspectorChange();
}

/**
 * 의뢰자 소통용 UI 식별 태그(data-ui-id) 인스펙터 오버레이
 *
 * - 개발 환경에서 기본 활성화(default: ON)되며, localStorage 로 상태가 유지됩니다.
 * - 프로덕션 환경(NODE_ENV === 'production')에서는 null 을 반환하여 DOM 및 번들 오버헤드가 전혀 없습니다.
 * - <input>, <select>, <textarea>, 제목, 본문 텍스트 등 모든 HTML 태그에 완벽하게 뱃지를 렌더링합니다.
 * - 뱃지를 직접 클릭하거나 Alt/Option/Cmd + 요소 클릭 시 data-ui-id 가 클립보드에 즉시 복사됩니다.
 * - 단축키:
 *   - macOS: ⌥U (Option+U) 또는 ⌘⇧U (Cmd+Shift+U)
 *   - Windows/Linux: Alt+U 또는 Ctrl+Shift+U
 */
export function UiInspectorOverlay(): ReactElement | null {
  const isEnabledEnv =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_INSPECTOR === 'true';

  const enabled = useSyncExternalStore(subscribeInspector, getInspectorSnapshot, getServerSnapshot);
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform),
    () => false,
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);

  const updateBadges = useCallback((): void => {
    if (!enabled) {
      setBadges([]);
      return;
    }

    const elements = document.querySelectorAll<HTMLElement>('[data-ui-id]');
    const newBadges: BadgeItem[] = [];

    elements.forEach((el) => {
      const uiId = el.getAttribute('data-ui-id');
      // 인스펙터 자체 버튼 및 복사 안내문은 뱃지 생성 제외
      if (!uiId || uiId === 'COM-BTN-INSPECTOR') return;

      const rect = el.getBoundingClientRect();
      // 화면에 보이지 않는 요소(너비/높이 0) 제외
      if (rect.width <= 0 && rect.height <= 0) return;

      // 뷰포트 기준 좌표 (fixed overlay 용)
      newBadges.push({
        id: uiId,
        top: Math.max(2, rect.top - 8),
        left: Math.max(2, rect.left + 2),
      });
    });

    setBadges(newBadges);
  }, [enabled]);

  // enabled 상태에 따라 body 클래스 동기화
  useEffect(() => {
    if (!isEnabledEnv) return;

    if (enabled) {
      document.body.classList.add('show-ui-tags');
    } else {
      document.body.classList.remove('show-ui-tags');
    }

    const animId = requestAnimationFrame(updateBadges);

    return () => {
      cancelAnimationFrame(animId);
      document.body.classList.remove('show-ui-tags');
    };
  }, [enabled, isEnabledEnv, updateBadges]);

  // 활성화 시 DOM 렌더링 지연 대응을 위한 비동기 다단계 위치 갱신
  useEffect(() => {
    if (!enabled) return;
    const t0 = setTimeout(updateBadges, 30);
    const t1 = setTimeout(updateBadges, 120);
    const t2 = setTimeout(updateBadges, 350);
    const t3 = setTimeout(updateBadges, 800);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [enabled, updateBadges]);

  // 스크롤, 리사이즈, DOM 변경 시 뱃지 위치 동기화
  useEffect(() => {
    if (!isEnabledEnv || !enabled) return;

    let animId: number;
    const handleSync = (): void => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(updateBadges);
    };

    window.addEventListener('scroll', handleSync, { passive: true, capture: true });
    window.addEventListener('resize', handleSync, { passive: true });

    const observer = new MutationObserver(handleSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ui-id', 'style', 'class'] });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('scroll', handleSync, true);
      window.removeEventListener('resize', handleSync);
      observer.disconnect();
    };
  }, [enabled, isEnabledEnv, updateBadges]);

  // 단축키 (Mac: ⌥U 또는 ⌘⇧U / Windows·Linux: Alt+U 또는 Ctrl+Shift+U)
  useEffect(() => {
    if (!isEnabledEnv) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      // macOS 에서 Option+U 입력 시 e.key 가 'Dead' 또는 '¨' 로 들어오므로 e.code === 'KeyU' 필수 확인
      const isKeyU = e.code === 'KeyU' || e.key.toLowerCase() === 'u';
      if (!isKeyU) return;

      const isAltU = e.altKey && !e.ctrlKey && !e.metaKey;
      const isCmdOrCtrlShiftU = (e.metaKey || e.ctrlKey) && e.shiftKey;

      if (isAltU || isCmdOrCtrlShiftU) {
        e.preventDefault();
        toggleInspector();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEnabledEnv]);

  // 복사 처리 함수
  const copyToClipboard = useCallback((id: string): void => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // Alt/Option 또는 Cmd + 클릭 시 요소 data-ui-id 복사
  useEffect(() => {
    if (!isEnabledEnv || !enabled) return;

    const handleClick = (e: MouseEvent): void => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-ui-id]');
      if (!target) return;

      const uiId = target.getAttribute('data-ui-id');
      // Mac: Cmd 또는 Option 클릭, Windows: Alt 클릭
      if (uiId && (e.altKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(uiId);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [enabled, isEnabledEnv, copyToClipboard]);

  if (!isEnabledEnv) {
    return null;
  }

  return (
    <>
      {/* ── 뱃지 플로팅 오버레이 레이어 ── */}
      {enabled && badges.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[99990] overflow-hidden select-none"
        >
          {badges.map((badge, idx) => (
            <div
              key={`${badge.id}-${idx}`}
              style={{
                position: 'fixed',
                top: `${badge.top}px`,
                left: `${badge.left}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(badge.id);
              }}
              title="클릭하여 ID 복사"
              className="pointer-events-auto cursor-pointer rounded bg-violet-600/90 px-1.5 py-0.5 text-[9px] font-bold font-mono text-white shadow-sm ring-1 ring-white/20 transition-all hover:scale-110 hover:bg-violet-700 hover:shadow-md active:scale-95"
            >
              {badge.id}
            </div>
          ))}
        </div>
      )}

      {/* ── 우하단 인스펙터 컨트롤러 ── */}
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
          onClick={toggleInspector}
          title={
            isMac
              ? '단축키: ⌥U 또는 ⌘⇧U (뱃지 클릭 또는 ⌥/⌘+요소 클릭 시 ID 복사)'
              : '단축키: Alt + U (뱃지 클릭 또는 Alt+요소 클릭 시 ID 복사)'
          }
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-xl transition-all ${
            enabled
              ? 'bg-violet-600 text-white ring-2 ring-violet-300 dark:ring-violet-800'
              : 'border border-border bg-surface/90 text-foreground backdrop-blur hover:bg-muted'
          }`}
        >
          <span aria-hidden>🏷️</span>
          <span>{enabled ? 'UI 태그 숨김' : 'UI 태그 보기'}</span>
          <kbd className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-mono uppercase opacity-80">
            {isMac ? '⌥U' : 'Alt+U'}
          </kbd>
        </button>
      </aside>
    </>
  );
}
