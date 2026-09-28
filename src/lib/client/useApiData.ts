'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { errMsg } from './api';

export interface ApiData<T> {
  data: T | null;
  error: string | null;
  reload: () => void;
  setData: (updater: (prev: T | null) => T | null) => void;
}

/**
 * loader 가 바뀌거나 reload() 가 호출될 때 데이터를 다시 불러온다.
 * 상태 갱신은 모두 Promise 콜백에서만 일어나므로 effect 내 동기 setState 가 없다.
 * pollMs 를 주면 해당 주기로 재조회한다.
 */
export function useApiData<T>(loader: () => Promise<T>, pollMs?: number | null): ApiData<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = (): void => {
      loader()
        .then((d) => {
          if (!cancelled) {
            setDataState(d);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(errMsg(e));
        });
    };
    run();
    const t = pollMs ? setInterval(run, pollMs) : null;
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [loader, tick, pollMs]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const setData = useCallback((updater: (prev: T | null) => T | null) => setDataState(updater), []);
  return { data, error, reload, setData };
}

const noopSubscribe = (): (() => void) => () => undefined;

/** 클라이언트 마운트 여부 (hydration mismatch 방지) */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
