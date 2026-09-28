import type { DispatchJobDoc } from '@/lib/db/models/DispatchJob';

export function jobSummary(j: DispatchJobDoc & { createdAt?: Date; updatedAt?: Date }): Record<string, unknown> {
  return {
    id: String(j._id),
    campaignName: j.campaignName,
    channel: j.channel,
    provider: j.provider,
    status: j.status,
    scheduledAt: j.scheduledAt ?? null,
    startedAt: j.startedAt ?? null,
    completedAt: j.completedAt ?? null,
    totalTargets: j.totalTargets,
    totalMessages: j.totalMessages,
    estimatedCost: j.estimatedCost,
    sentCount: j.sentCount,
    failedCount: j.failedCount,
    skippedCount: j.skippedCount,
    totalCost: j.totalCost,
    fallbackToLms: j.fallbackToLms,
    errorMessage: j.errorMessage ?? '',
    createdAt: j.createdAt ?? null,
  };
}
