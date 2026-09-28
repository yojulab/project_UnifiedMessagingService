import { z } from 'zod';
import { notFound, ok, parseBody, withAuth } from '@/lib/api';
import { User } from '@/lib/db/models/User';
import { normalizePhone } from '@/lib/validators/contactNormalizer';

function view(u: { email: string; name: string; company?: string | null; defaultSenderPhone?: string | null; defaultSenderEmail?: string | null; themeMode?: string | null; accentColor?: string | null }): Record<string, unknown> {
  return {
    email: u.email, name: u.name, company: u.company ?? '', defaultSenderPhone: u.defaultSenderPhone ?? '',
    defaultSenderEmail: u.defaultSenderEmail ?? '', themeMode: u.themeMode ?? 'system', accentColor: u.accentColor ?? 'blue',
  };
}

export const GET = withAuth(async (_req, _ctx, user) => {
  const u = await User.findById(user.oid).lean();
  if (!u) throw notFound('사용자');
  return ok(view(u));
});

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  company: z.string().trim().max(100).optional(),
  defaultSenderPhone: z.string().trim().max(20).optional()
    .refine((v) => !v || normalizePhone(v) !== null, '발신 번호 형식이 올바르지 않습니다.'),
  defaultSenderEmail: z.union([z.email('발신 이메일 형식이 올바르지 않습니다.'), z.literal('')]).optional(),
});

export const PATCH = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, PatchSchema);
  if (input.defaultSenderPhone) input.defaultSenderPhone = normalizePhone(input.defaultSenderPhone) ?? '';
  const u = await User.findOneAndUpdate({ _id: user.oid }, { $set: input }, { returnDocument: 'after' }).lean();
  if (!u) throw notFound('사용자');
  return ok(view(u));
});
