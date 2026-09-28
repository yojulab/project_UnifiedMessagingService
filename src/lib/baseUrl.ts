/** 서버 런타임 기준 서비스 URL — NEXT_PUBLIC_* 는 빌드 시 고정되므로 NEXTAUTH_URL 을 우선한다. */
export function baseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
}
