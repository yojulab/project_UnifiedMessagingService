import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { ZodError, type ZodType } from 'zod';
import { connectDB } from '@/lib/db/connection';
import { getSessionUser, type SessionUser } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = '리소스'): AppError => new AppError(404, 'NOT_FOUND', `${what}를 찾을 수 없습니다.`);

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(status: number, code: string, message: string): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** 인증된 테넌트 사용자 — `oid` 는 모든 쿼리의 userId 필터로 사용한다. */
export interface AuthedUser extends SessionUser {
  oid: Types.ObjectId;
}

export function toObjectId(id: string, what = '리소스'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw notFound(what);
  return new Types.ObjectId(id);
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(400, 'INVALID_JSON', '요청 본문이 올바른 JSON 이 아닙니다.');
  }
  return schema.parse(raw);
}

export function handleError(err: unknown): NextResponse<ApiResponse<never>> {
  if (err instanceof AppError) return fail(err.status, err.code, err.message);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join('.') ?? '';
    return fail(400, 'VALIDATION_ERROR', `${path ? `${path}: ` : ''}${first?.message ?? '입력값이 올바르지 않습니다.'}`);
  }
  console.error('[api] 처리되지 않은 오류:', err instanceof Error ? err.message : 'unknown');
  return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
}

type Handler<C> = (req: NextRequest, ctx: C, user: AuthedUser) => Promise<Response>;

/** 세션 검증 + DB 연결 + 에러 처리를 공통 적용하는 API 래퍼. */
export function withAuth<C = unknown>(handler: Handler<C>): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const user = await getSessionUser();
      if (!user) return fail(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
      await connectDB();
      return await handler(req, ctx, { ...user, oid: new Types.ObjectId(user.id) });
    } catch (err) {
      return handleError(err);
    }
  };
}

/** 인증이 필요 없는 공개 API 래퍼 (회원가입, 수신거부, 웹훅). */
export function withPublic<C = unknown>(
  handler: (req: NextRequest, ctx: C) => Promise<Response>,
): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      await connectDB();
      return await handler(req, ctx);
    } catch (err) {
      return handleError(err);
    }
  };
}
