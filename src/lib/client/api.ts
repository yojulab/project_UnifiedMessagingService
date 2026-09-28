'use client';

import type { ApiResponse } from '@/types';

export class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** API 호출 — { success, data | error } 형식을 풀어 data 를 반환하고 실패 시 예외 */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ClientApiError(`서버 응답을 해석할 수 없습니다. (HTTP ${res.status})`, 'BAD_RESPONSE', res.status);
  }
  if (!payload.success) {
    if (res.status === 401 && typeof window !== 'undefined') window.location.reload();
    throw new ClientApiError(payload.error.message, payload.error.code, res.status);
  }
  return payload.data;
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
}

export function qs(params: Record<string, string | number | boolean | string[] | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '' || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
