import type { ConfigTemplate } from '@/types';

export interface ProviderCode {
  code: string;
  name: string;
  channels: string[];
  configTemplate: ConfigTemplate | null;
}

export interface PlatformConfigView {
  id: string;
  name: string;
  channel: string;
  provider: string;
  providerName: string;
  configData: Record<string, string>;
  isDefault: boolean;
  status: string;
  lastTestMessage: string;
  lastTestedAt: string | null;
}

export interface TestResult {
  connected: boolean;
  message: string;
}
