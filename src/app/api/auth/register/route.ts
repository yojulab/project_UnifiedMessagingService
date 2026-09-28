import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError, ok, parseBody, withPublic } from '@/lib/api';
import { BCRYPT_ROUNDS } from '@/lib/auth';
import { User } from '@/lib/db/models/User';

const RegisterSchema = z.object({
  email: z.email('이메일 형식이 올바르지 않습니다.').transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(100),
  name: z.string().trim().min(1, '이름을 입력하세요.').max(50),
  company: z.string().trim().max(100).optional().default(''),
});

export const POST = withPublic(async (req) => {
  const input = await parseBody(req, RegisterSchema);
  const exists = await User.exists({ email: input.email });
  if (exists) throw new AppError(409, 'EMAIL_TAKEN', '이미 가입된 이메일입니다.');
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await User.create({
    email: input.email,
    passwordHash,
    name: input.name,
    company: input.company,
    defaultSenderEmail: input.email,
  });
  return ok({ id: String(user._id), email: user.email, name: user.name }, 201);
});
