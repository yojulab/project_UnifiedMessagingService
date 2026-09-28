import { z } from 'zod';
import { ok, parseBody, withAuth } from '@/lib/api';
import { User } from '@/lib/db/models/User';
import { ACCENT_COLORS, THEME_MODES } from '@/types';

const ThemeSchema = z.object({
  themeMode: z.enum(THEME_MODES).optional(),
  accentColor: z.enum(ACCENT_COLORS).optional(),
});

export const PATCH = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, ThemeSchema);
  await User.updateOne({ _id: user.oid }, { $set: input });
  return ok(input);
});
