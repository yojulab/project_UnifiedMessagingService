import type { Channel, UnsubChannel } from '@/types';

/** 연락처 자체의 수신거부 상태 (연락처 전체 / 채널 전체) */
export interface ContactUnsubState {
  isUnsubscribed?: boolean | null;
  unsubscribedChannels?: string[] | null;
}

/** 억제 목록 조회 결과 — `${channel}:${value}` 키 집합 */
export type SuppressedSet = ReadonlySet<string>;

export function suppressionKey(channel: UnsubChannel, value: string): string {
  return `${channel}:${value}`;
}

/** LMS 는 SMS 수신거부를 따른다. */
export function toUnsubChannel(channel: Channel): UnsubChannel {
  if (channel === 'LMS' || channel === 'SMS') return 'SMS';
  return channel;
}

/**
 * 발송 판정의 단일 진입점 — 번호/이메일 단위로 수신거부 여부를 판단한다.
 * suppressed 는 테넌트 억제 목록(연락처와 독립)에서 불러온 값이다.
 */
export function isRecipientBlocked(contact: ContactUnsubState, channel: Channel, value: string, suppressed: SuppressedSet): boolean {
  if (contact.isUnsubscribed) return true;
  const ch = toUnsubChannel(channel);
  if (contact.unsubscribedChannels?.includes(ch)) return true;
  // 카카오 알림톡은 휴대폰 번호 기반이므로 SMS 번호 거부도 존중한다
  const chans: UnsubChannel[] = ch === 'KAKAO' ? ['KAKAO', 'SMS'] : [ch];
  return chans.some((c) => suppressed.has(suppressionKey(c, value)));
}

/** 연락처에서 채널별 발송 가능한 수신자 목록 */
export function activeRecipients(
  contact: ContactUnsubState & { phones?: string[] | null; emails?: string[] | null },
  channel: Channel,
  suppressed: SuppressedSet,
): string[] {
  const list = channel === 'EMAIL' ? (contact.emails ?? []) : (contact.phones ?? []);
  const mobileOnly = channel === 'KAKAO';
  return list.filter((v) => !isRecipientBlocked(contact, channel, v, suppressed) && (!mobileOnly || /^01[016789]/.test(v)));
}
