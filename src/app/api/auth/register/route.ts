import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError, ok, parseBody, withPublic } from '@/lib/api';
import { BCRYPT_ROUNDS } from '@/lib/auth';
import { User } from '@/lib/db/models/User';

const RegisterSchema = z.object({
  email: z.email('이메일 형식이 올바르지 않습니다.').transform((v) => v.toLowerCase().trim()),
  password: z
    .string({ error: '비밀번호를 입력하세요.' })
    .min(8, '비밀번호는 8자 이상이어야 합니다.')
    .max(100, '비밀번호는 100자 이하여야 합니다.'),
  name: z
    .string({ error: '이름을 입력하세요.' })
    .trim()
    .min(1, '이름을 입력하세요.')
    .max(50, '이름은 50자 이하여야 합니다.'),
  company: z
    .string({ error: '회사명은 문자열이어야 합니다.' })
    .trim()
    .max(100, '회사명은 100자 이하여야 합니다.')
    .optional()
    .default(''),
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
