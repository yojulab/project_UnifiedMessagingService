import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { fail, ok, withPublic } from '@/lib/api';
import { Contact } from '@/lib/db/models/Contact';
import { suppress } from '@/lib/unsubscribe/service';
import { verifyUnsubToken } from '@/lib/unsubscribe/token';

/** GET 은 상태를 바꾸지 않는다 — 메일 스캐너 프리패치 방지를 위해 확인 페이지로 이동 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, req.url), 303);
}

async function readToken(req: NextRequest): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    return typeof body.token === 'string' ? body.token : null;
  }
  if (type.includes('form')) {
    const form = await req.formData().catch(() => null);
    const t = form?.get('token');
    return typeof t === 'string' ? t : null;
  }
  return null;
}

/** 확인 페이지 제출 또는 RFC 8058 원클릭(List-Unsubscribe=One-Click) — 토큰으로 테넌트 식별 */
export const POST = withPublic(async (req) => {
  const payload = verifyUnsubToken(await readToken(req));
  if (!payload || !Types.ObjectId.isValid(payload.contactId) || !Types.ObjectId.isValid(payload.userId)) {
    return fail(400, 'INVALID_TOKEN', '유효하지 않은 수신거부 링크입니다.');
  }
  const userId = new Types.ObjectId(payload.userId);
  const email = payload.email.toLowerCase();
  // 연락처 존재 여부와 무관하게 테넌트 억제 목록에 기록 (삭제·재업로드 후에도 유지)
  const contactId = await Contact.exists({ _id: new Types.ObjectId(payload.contactId), userId });
  await suppress(userId, 'EMAIL', [email], 'OPT_OUT_EMAIL', contactId?._id ?? null);
  return ok({ unsubscribed: true, email });
});
