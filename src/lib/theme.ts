import { Types } from 'mongoose';
import { getSessionUser } from '@/lib/auth';
import { connectDB } from '@/lib/db/connection';
import { User } from '@/lib/db/models/User';
import { ACCENT_COLORS, THEME_MODES, type AccentColor, type ThemeMode } from '@/types';

export interface ThemePref {
  themeMode: ThemeMode;
  accentColor: AccentColor;
}

/** 서버 렌더링 시 로그인 사용자의 테마 설정 (깜빡임 방지용 SSR 주입) */
export async function getThemePref(): Promise<ThemePref> {
  const fallback: ThemePref = { themeMode: 'system', accentColor: 'blue' };
  try {
    const user = await getSessionUser();
    if (!user) return fallback;
    await connectDB();
    const u = await User.findById(new Types.ObjectId(user.id), { themeMode: 1, accentColor: 1 }).lean();
    const mode = (THEME_MODES as readonly string[]).includes(u?.themeMode ?? '') ? (u?.themeMode as ThemeMode) : 'system';
    const accent = (ACCENT_COLORS as readonly string[]).includes(u?.accentColor ?? '') ? (u?.accentColor as AccentColor) : 'blue';
    return { themeMode: mode, accentColor: accent };
  } catch {
    return fallback;
  }
}
