import { ok, withAuth } from '@/lib/api';
import { CommonCode } from '@/lib/db/models/CommonCode';

function parseTemplate(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export const GET = withAuth(async (req) => {
  const category = req.nextUrl.searchParams.get('category');
  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
  const codes = await CommonCode.find(filter).sort({ category: 1, sortOrder: 1 }).lean();
  return ok(
    codes.map((c) => ({
      category: c.category,
      code: c.code,
      name: c.name,
      sortOrder: c.sortOrder,
      channels: c.channels ?? [],
      configTemplate: parseTemplate(c.configTemplate),
    })),
  );
});
