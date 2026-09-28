import { ok, parseBody, withAuth } from '@/lib/api';
import { estimateCampaign } from '@/lib/dispatch/campaignService';
import { EstimateInputSchema } from '@/lib/validators/schemas';

/** Step 2~4: 대상 고객 수 / 예상 발송 건수 / 예상 비용 / 샘플 미리보기 */
export const POST = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, EstimateInputSchema);
  return ok(await estimateCampaign(user.oid, input));
});
