import { ok, withAuth } from '@/lib/api';
import { optOutWebhookUrl } from '@/lib/unsubscribe/service';

/** 회원별 080 수신거부 웹훅 URL (공급사 콘솔에 등록) */
export const GET = withAuth(async (_req, _ctx, user) => {
  return ok({ ALIGO: optOutWebhookUrl(user.id, 'ALIGO'), SOLAPI: optOutWebhookUrl(user.id, 'SOLAPI') });
});
