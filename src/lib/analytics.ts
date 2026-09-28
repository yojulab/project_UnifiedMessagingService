/** from/to (YYYY-MM-DD, KST) → [from, to) Date 범위. 기본 최근 30일 */
export function parseRange(sp: URLSearchParams): { from: Date; to: Date } {
  const kst = (d: string): Date | null => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+09:00`) : null);
  const toParam = kst(sp.get('to') ?? '');
  const to = toParam ? new Date(toParam.getTime() + 86_400_000) : new Date(Date.now() + 60_000);
  const fromParam = kst(sp.get('from') ?? '');
  const from = fromParam ?? new Date(to.getTime() - 30 * 86_400_000);
  return { from, to };
}
