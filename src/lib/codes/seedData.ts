import type { ConfigTemplate } from '@/types';

export interface CommonCodeSeed {
  category: 'MSG_CHANNEL' | 'PROVIDER' | 'DISPATCH_STATUS' | 'UNSUB_REASON';
  code: string;
  name: string;
  sortOrder: number;
  channels?: string[];
  configTemplate?: string | null;
}

const tpl = (t: ConfigTemplate): string => JSON.stringify(t);

const OPT_OUT: ConfigTemplate[string] = {
  label: '080 무료수신거부 번호',
  required: false,
  help: '광고 문자 발송 시 본문 하단에 자동 삽입됩니다. 예: 080-123-4567',
};
const UNIT_COST: ConfigTemplate[string] = {
  label: '건당 단가(원, 선택)',
  required: false,
  help: '미입력 시 채널 기본 단가로 견적을 계산합니다.',
};

export const commonCodeSeeds: CommonCodeSeed[] = [
  // ── 발송 채널 ──
  { category: 'MSG_CHANNEL', code: 'EMAIL', name: '이메일', sortOrder: 1 },
  { category: 'MSG_CHANNEL', code: 'SMS', name: 'SMS', sortOrder: 2 },
  { category: 'MSG_CHANNEL', code: 'LMS', name: 'LMS', sortOrder: 3 },
  { category: 'MSG_CHANNEL', code: 'KAKAO', name: '카카오 알림톡', sortOrder: 4 },

  // ── 공급사 ──
  {
    category: 'PROVIDER', code: 'ZOHO', name: 'Zoho Mail REST API', sortOrder: 1, channels: ['EMAIL'],
    configTemplate: tpl({
      clientId: { label: 'Client ID', required: true, secret: true },
      clientSecret: { label: 'Client Secret', required: true, secret: true },
      refreshToken: { label: 'Refresh Token', required: true, secret: true },
      accountId: { label: 'Account ID', required: true },
      senderAddress: { label: '발신 이메일', required: true },
      accountsDomain: { label: 'Accounts 도메인', required: false, default: 'accounts.zoho.com' },
      mailDomain: { label: 'Mail API 도메인', required: false, default: 'mail.zoho.com' },
      unitCost: UNIT_COST,
    }),
  },
  {
    category: 'PROVIDER', code: 'AWS_SES', name: 'AWS SES', sortOrder: 2, channels: ['EMAIL'],
    configTemplate: tpl({
      accessKeyId: { label: 'Access Key ID', required: true, secret: true },
      secretAccessKey: { label: 'Secret Access Key', required: true, secret: true },
      region: { label: 'Region', required: true, default: 'ap-northeast-2' },
      senderAddress: { label: '발신 이메일', required: true },
      unitCost: UNIT_COST,
    }),
  },
  {
    category: 'PROVIDER', code: 'ALIGO', name: '알리고 SMS', sortOrder: 3, channels: ['SMS', 'LMS'],
    configTemplate: tpl({
      apiKey: { label: 'API Key', required: true, secret: true },
      userId: { label: 'User ID', required: true },
      senderNumber: { label: '발신 번호', required: true },
      optOutNumber: OPT_OUT,
      unitCost: UNIT_COST,
    }),
  },
  {
    category: 'PROVIDER', code: 'SOLAPI', name: '솔라피', sortOrder: 4, channels: ['SMS', 'LMS', 'KAKAO'],
    configTemplate: tpl({
      apiKey: { label: 'API Key', required: true, secret: true },
      apiSecret: { label: 'API Secret', required: true, secret: true },
      senderNumber: { label: '발신 번호', required: true },
      optOutNumber: OPT_OUT,
      kakaoPfId: { label: '카카오 채널 pfId (알림톡)', required: false },
      kakaoTemplateId: { label: '알림톡 템플릿 ID', required: false },
      unitCost: UNIT_COST,
    }),
  },

  // ── 발송 상태 ──
  { category: 'DISPATCH_STATUS', code: 'DRAFT', name: '작성중', sortOrder: 0 },
  { category: 'DISPATCH_STATUS', code: 'PENDING', name: '대기', sortOrder: 1 },
  { category: 'DISPATCH_STATUS', code: 'SENDING', name: '발송중', sortOrder: 2 },
  { category: 'DISPATCH_STATUS', code: 'COMPLETED', name: '완료', sortOrder: 3 },
  { category: 'DISPATCH_STATUS', code: 'FAILED', name: '실패', sortOrder: 4 },
  { category: 'DISPATCH_STATUS', code: 'PARTIAL', name: '부분성공', sortOrder: 5 },
  { category: 'DISPATCH_STATUS', code: 'CANCELLED', name: '취소', sortOrder: 6 },

  // ── 수신거부 사유 ──
  { category: 'UNSUB_REASON', code: 'OPT_OUT_080', name: '080 수신거부', sortOrder: 1 },
  { category: 'UNSUB_REASON', code: 'OPT_OUT_EMAIL', name: '이메일 수신거부', sortOrder: 2 },
  { category: 'UNSUB_REASON', code: 'MANUAL', name: '관리자 수동 등록', sortOrder: 3 },
];

/** 채널 기본 단가(원) — PlatformConfig.configData.unitCost 로 재정의 가능 */
export const DEFAULT_UNIT_COST: Record<string, number> = { EMAIL: 1, SMS: 20, LMS: 50, KAKAO: 15 };
