export const CHANNELS = ['EMAIL', 'SMS', 'LMS', 'KAKAO'] as const;
export type Channel = (typeof CHANNELS)[number];

/** 수신거부 채널 — LMS 는 SMS 거부를 따른다. */
export const UNSUB_CHANNELS = ['SMS', 'EMAIL', 'KAKAO'] as const;
export type UnsubChannel = (typeof UNSUB_CHANNELS)[number];

export const UNSUB_REASONS = ['OPT_OUT_080', 'OPT_OUT_EMAIL', 'MANUAL'] as const;
export type UnsubReason = (typeof UNSUB_REASONS)[number];

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const ACCENT_COLORS = ['blue', 'indigo', 'emerald', 'violet', 'rose', 'slate'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DISPATCH_STATUSES = ['DRAFT', 'PENDING', 'SENDING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const RESULT_CODES = ['SUCCESS', 'FAILED', 'BOUNCED', 'PENDING', 'SKIPPED'] as const;
export type ResultCode = (typeof RESULT_CODES)[number];

export const TARGET_MODES = ['ALL', 'TOP_N', 'RANDOM_N'] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

export const TOP_N_SORTS = ['createdAt_desc', 'createdAt_asc', 'name_asc'] as const;
export type TopNSort = (typeof TOP_N_SORTS)[number];

export const DUPLICATE_HANDLING = ['skip', 'overwrite', 'create_new'] as const;
export type DuplicateHandling = (typeof DUPLICATE_HANDLING)[number];

export interface TargetFilter {
  mode: TargetMode;
  limit?: number | null;
  sort?: TopNSort;
  labels?: string[];
  sourceNames?: string[];
  keywords?: string;
}

export interface MessageTemplate {
  subject?: string;
  body: string;
  isHtml?: boolean;
  isAd?: boolean;
}

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError };

export interface ConfigTemplateField {
  label: string;
  required: boolean;
  default?: string;
  secret?: boolean;
  help?: string;
}
export type ConfigTemplate = Record<string, ConfigTemplateField>;
