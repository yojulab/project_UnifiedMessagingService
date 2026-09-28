import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/connection';
import { User } from '@/lib/db/models/User';

export const BCRYPT_ROUNDS = 12;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;
        await connectDB();
        const user = await User.findOne({ email }).lean();
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: String(user._id), email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.uid === 'string') {
        (session.user as SessionUser).id = token.uid;
      }
      return session;
    },
  },
};

/** 현재 세션 사용자. 없으면 null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as Partial<SessionUser> | undefined;
  if (!u?.id || !Types.ObjectId.isValid(u.id)) return null;
  return { id: u.id, email: u.email ?? '', name: u.name ?? '' };
}
