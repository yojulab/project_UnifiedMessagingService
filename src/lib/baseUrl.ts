/**
 * 서버 런타임 기준 서비스 URL — 수신거부·웹훅 링크에 쓰인다.
 * PUBLIC_BASE_URL(외부 공개 주소) → NEXTAUTH_URL → NEXT_PUBLIC_BASE_URL 순. NEXT_PUBLIC_* 는 빌드 시 고정되므로 마지막 대체값.
 */
export function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

/** 수신자가 외부에서 열 수 있는 주소인지 (localhost·사설 IP·.local 은 불가) */
export function isPublicUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (host === '::1' || host === '[::1]' || host === '0.0.0.0') return false;
  const m = host.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return false;
  }
  return true;
}
