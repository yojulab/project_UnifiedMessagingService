import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError, notFound, ok, parseBody, withAuth } from '@/lib/api';
import { BCRYPT_ROUNDS } from '@/lib/auth';
import { User } from '@/lib/db/models/User';

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다.').max(100),
});

export const POST = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, Schema);
  const u = await User.findById(user.oid);
  if (!u) throw notFound('사용자');
  if (!(await bcrypt.compare(input.currentPassword, u.passwordHash))) {
    throw new AppError(400, 'WRONG_PASSWORD', '현재 비밀번호가 올바르지 않습니다.');
  }
  u.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await u.save();
  return ok({ changed: true });
});
