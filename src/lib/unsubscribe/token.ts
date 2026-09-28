import crypto from 'node:crypto';
import { baseUrl } from '@/lib/baseUrl';

export interface UnsubPayload {
  contactId: string;
  email: string;
  userId: string;
}

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('UNSUBSCRIBE_SECRET 가 설정되지 않았습니다.');
  return s;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

/** token = base64url(JSON{c,e,u}) + '.' + base64url(HMAC-SHA256) */
export function signUnsubToken(p: UnsubPayload): string {
  const data = Buffer.from(JSON.stringify({ c: p.contactId, e: p.email, u: p.userId })).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function verifyUnsubToken(token: string | null | undefined): UnsubPayload | null {
  if (!token || typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const obj: unknown = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (typeof obj !== 'object' || obj === null) return null;
    const { c, e, u } = obj as Record<string, unknown>;
    if (typeof c !== 'string' || typeof e !== 'string' || typeof u !== 'string') return null;
    return { contactId: c, email: e, userId: u };
  } catch {
    return null;
  }
}

export function unsubscribePageUrl(token: string): string {
  return `${baseUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function unsubscribeApiUrl(token: string): string {
  return `${baseUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** RFC 8058 원클릭 수신거부 헤더 */
export function listUnsubscribeHeaders(token: string, senderAddress?: string): Record<string, string> {
  const parts = [`<${unsubscribeApiUrl(token)}>`];
  if (senderAddress) parts.push(`<mailto:${senderAddress}?subject=unsubscribe>`);
  return {
    'List-Unsubscribe': parts.join(', '),
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
