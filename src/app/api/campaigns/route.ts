import { after } from 'next/server';
import { ok, parseBody, withAuth } from '@/lib/api';
import { DispatchJob, type DispatchJobDoc } from '@/lib/db/models/DispatchJob';
import { createCampaign } from '@/lib/dispatch/campaignService';
import { processJob } from '@/lib/dispatch/engine';
import { jobSummary } from '@/lib/dispatch/views';
import { CampaignInputSchema } from '@/lib/validators/schemas';

export const GET = withAuth(async (req, _ctx, user) => {
  const status = req.nextUrl.searchParams.get('status');
  const filter: Record<string, unknown> = { userId: user.oid };
  if (status) filter.status = status;
  const jobs = (await DispatchJob.find(filter, { targetContactIds: 0 }).sort({ createdAt: -1 }).limit(100).lean()) as DispatchJobDoc[];
  return ok(jobs.map(jobSummary));
});

/** Step 4: 발송 확정 — 즉시 발송은 응답 후 백그라운드 실행, 예약은 스케줄러가 처리 */
export const POST = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, CampaignInputSchema);
  const result = await createCampaign(user.oid, input);
  if (!result.scheduled) {
    after(async () => {
      try {
        await processJob(result.id);
      } catch (err) {
        console.error('[dispatch] 즉시 발송 실패:', err instanceof Error ? err.message : err);
      }
    });
  }
  return ok(result, 201);
});
