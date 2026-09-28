import { Types } from 'mongoose';
import { fail, ok, withPublic } from '@/lib/api';
import { blockRecipients, extractPhones, verifyWebhookSignature } from '@/lib/unsubscribe/service';
import { normalizePhone } from '@/lib/validators/contactNormalizer';

type Ctx = { params: Promise<{ provider: string }> };

/** 공급사 080 수신거부 웹훅 — URL 의 uid + HMAC sig 로 테넌트 인증 */
export const POST = withPublic<Ctx>(async (req) => {
  const uid = req.nextUrl.searchParams.get('uid') ?? '';
  const sig = req.nextUrl.searchParams.get('sig') ?? '';
  if (!Types.ObjectId.isValid(uid) || !verifyWebhookSignature(uid, sig)) {
    return fail(401, 'INVALID_SIGNATURE', '웹훅 서명이 올바르지 않습니다.');
  }
  const type = req.headers.get('content-type') ?? '';
  let body: unknown = {};
  if (type.includes('application/json')) body = await req.json().catch(() => ({}));
  else if (type.includes('form')) {
    const form = await req.formData().catch(() => null);
    body = form ? Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) : {};
  }
  const numbers = [...new Set(extractPhones(body).map((p) => normalizePhone(p)).filter((v): v is string => Boolean(v)))];
  const result = await blockRecipients(new Types.ObjectId(uid), 'SMS', numbers, 'OPT_OUT_080');
  return ok({ received: numbers.length, ...result });
});
