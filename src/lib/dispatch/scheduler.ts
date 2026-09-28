import { processDueJobs } from './engine';

declare global {
  var dispatchSchedulerStarted: boolean | undefined;
}

/** 예약 발송/복구 폴러 — 프로세스당 1회만 시작 */
export function startDispatchScheduler(): void {
  if (globalThis.dispatchSchedulerStarted) return;
  globalThis.dispatchSchedulerStarted = true;
  const interval = Number(process.env.DISPATCH_POLL_INTERVAL_MS ?? 30_000);
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await processDueJobs();
    } catch (err) {
      console.error('[scheduler] 예약 발송 처리 실패:', err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };
  setInterval(() => void tick(), interval).unref();
  console.log(`[scheduler] 예약 발송 폴러 시작 (${interval}ms)`);
}
