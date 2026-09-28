import type { Channel } from '@/types';
import type { AdapterConfig, IMessagingAdapter } from './IMessagingAdapter';
import { DryRunAdapter, isDryRun } from './DryRunAdapter';
import { SesAdapter } from './email/SesAdapter';
import { ZohoAdapter } from './email/ZohoAdapter';
import { AligoAdapter } from './sms/AligoAdapter';
import { SolapiAdapter } from './sms/SolapiAdapter';

type AdapterCtor = (channel: Channel, config: AdapterConfig) => IMessagingAdapter;

/** `${CHANNEL}:${PROVIDER}` → 생성 함수. 새 공급사는 여기 1줄 + CommonCode 시드 1건 추가. */
const adapterRegistry: Record<string, AdapterCtor> = {
  'EMAIL:ZOHO': (_c, cfg) => new ZohoAdapter(cfg),
  'EMAIL:AWS_SES': (_c, cfg) => new SesAdapter(cfg),
  'SMS:ALIGO': (c, cfg) => new AligoAdapter(c, cfg),
  'LMS:ALIGO': (c, cfg) => new AligoAdapter(c, cfg),
  'SMS:SOLAPI': (c, cfg) => new SolapiAdapter(c, cfg),
  'LMS:SOLAPI': (c, cfg) => new SolapiAdapter(c, cfg),
  'KAKAO:SOLAPI': (c, cfg) => new SolapiAdapter(c, cfg),
};

export class AdapterFactory {
  static create(channel: Channel, provider: string, decryptedConfig: AdapterConfig): IMessagingAdapter {
    const key = `${channel}:${provider}`;
    const ctor = adapterRegistry[key];
    if (!ctor) throw new Error(`지원되지 않는 어댑터: ${key}`);
    // 필수 설정 검증은 실제 어댑터 생성자에서 수행 (DRY_RUN 에서도 동일하게 검증)
    const real = ctor(channel, decryptedConfig);
    return isDryRun() ? new DryRunAdapter(channel, provider, decryptedConfig) : real;
  }

  static isSupported(channel: string, provider: string): boolean {
    return `${channel}:${provider}` in adapterRegistry;
  }

  static supportedChannels(provider: string): Channel[] {
    return Object.keys(adapterRegistry)
      .filter((k) => k.endsWith(`:${provider}`))
      .map((k) => k.split(':')[0] as Channel);
  }
}
