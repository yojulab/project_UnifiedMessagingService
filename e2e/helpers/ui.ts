import type { Locator } from '@playwright/test';

/** 표의 본문 행 (헤더 행 제외) — 역할 기반 */
export function bodyRows(table: Locator): Locator {
  return table.getByRole('rowgroup').nth(1).getByRole('row');
}
