import { z } from 'zod';
import { CHANNELS, DUPLICATE_HANDLING, TARGET_MODES, TOP_N_SORTS } from '@/types';

export const ChannelSchema = z.enum(CHANNELS);

const ConfigDataSchema = z.record(z.string(), z.union([z.string(), z.number()]).transform((v) => String(v)));

export const PlatformConfigInputSchema = z.object({
  name: z.string().trim().max(100).optional().default(''),
  channel: ChannelSchema,
  provider: z.string().trim().min(1),
  configData: ConfigDataSchema,
  isDefault: z.boolean().optional().default(false),
});

export const PlatformConfigUpdateSchema = z.object({
  name: z.string().trim().max(100).optional(),
  configData: ConfigDataSchema.optional(),
  isDefault: z.boolean().optional(),
});

export const PlatformConfigTestSchema = z.object({
  id: z.string().optional(),
  channel: ChannelSchema,
  provider: z.string().trim().min(1),
  configData: ConfigDataSchema,
});

export const TargetFilterSchema = z.object({
  mode: z.enum(TARGET_MODES).default('ALL'),
  limit: z.number().int().positive().max(1_000_000).nullable().optional(),
  sort: z.enum(TOP_N_SORTS).optional().default('createdAt_desc'),
  labels: z.array(z.string()).optional().default([]),
  sourceNames: z.array(z.string()).optional().default([]),
  keywords: z.string().trim().max(200).optional().default(''),
}).refine((f) => f.mode === 'ALL' || (f.limit !== null && f.limit !== undefined), {
  message: '상위 N / 무작위 N 모드는 N 값이 필요합니다.',
  path: ['limit'],
});

export const MessageTemplateSchema = z.object({
  subject: z.string().max(200).optional().default(''),
  body: z.string().trim().min(1, '본문을 입력하세요.').max(20000),
  isHtml: z.boolean().optional().default(false),
  isAd: z.boolean().optional().default(true),
});

export const CampaignInputSchema = z.object({
  campaignName: z.string().trim().min(1, '캠페인명을 입력하세요.').max(200),
  platformConfigId: z.string().min(1),
  fallbackToLms: z.boolean().optional().default(false),
  fallbackConfigId: z.string().nullable().optional(),
  targetFilter: TargetFilterSchema,
  messageTemplate: MessageTemplateSchema,
  scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const EstimateInputSchema = z.object({
  platformConfigId: z.string().min(1),
  targetFilter: TargetFilterSchema,
  messageTemplate: MessageTemplateSchema.partial().optional(),
});

export const MappedColumnsSchema = z.object({
  name: z.string().min(1, '이름 컬럼을 선택하세요.'),
  phones: z.array(z.string()).default([]),
  emails: z.array(z.string()).default([]),
  company: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
  labelsColumn: z.string().optional(),
  custom: z.record(z.string(), z.string()).optional().default({}),
}).refine((m) => m.phones.length + m.emails.length > 0, {
  message: '전화번호 또는 이메일 컬럼을 1개 이상 선택하세요.',
  path: ['phones'],
});

export const ImportOptionsSchema = z.object({
  mappedColumns: MappedColumnsSchema,
  duplicateHandling: z.enum(DUPLICATE_HANDLING).default('skip'),
  labels: z.array(z.string().trim().min(1)).optional().default([]),
});

export type MappedColumns = z.infer<typeof MappedColumnsSchema>;
