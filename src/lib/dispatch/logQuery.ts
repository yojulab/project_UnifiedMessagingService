import type { Types } from 'mongoose';
import { escapeRegex } from '@/lib/contacts/queries';
import { RESULT_CODES } from '@/types';

export function buildLogFilter(userId: Types.ObjectId, jobId: Types.ObjectId, sp: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = { userId, dispatchJobId: jobId };
  const rc = sp.get('resultCode');
  if (rc && (RESULT_CODES as readonly string[]).includes(rc)) filter.resultCode = rc;
  const q = sp.get('q')?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.replace(/-/g, '')), 'i');
    filter.$or = [{ recipient: rx }, { contactName: new RegExp(escapeRegex(q), 'i') }];
  }
  return filter;
}
