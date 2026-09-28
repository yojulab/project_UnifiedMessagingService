import { describe, expect, it } from 'vitest';
import { activeRecipients, isRecipientBlocked, suppressionKey } from './isBlocked';
import { listUnsubscribeHeaders, signUnsubToken, verifyUnsubToken } from './token';

describe('unsubscribe token', () => {
  const p = { contactId: 'c1', email: 'a@b.com', userId: 'u1' };

  it('서명 후 검증하면 원래 페이로드', () => {
    expect(verifyUnsubToken(signUnsubToken(p))).toEqual(p);
  });

  it('페이로드 위조 시 null', () => {
    const [, sig] = signUnsubToken(p).split('.');
    const forged = Buffer.from(JSON.stringify({ c: 'c2', e: 'x@y.com', u: 'u1' })).toString('base64url');
    expect(verifyUnsubToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyUnsubToken('garbage')).toBeNull();
    expect(verifyUnsubToken('')).toBeNull();
  });

  it('RFC 8058 헤더', () => {
    const h = listUnsubscribeHeaders('tok', 'from@x.com');
    expect(h['List-Unsubscribe']).toBe('<http://localhost:3000/api/unsubscribe?token=tok>, <mailto:from@x.com?subject=unsubscribe>');
    expect(h['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});

describe('isRecipientBlocked (억제 목록 기반)', () => {
  const contact = {
    isUnsubscribed: false,
    unsubscribedChannels: [] as string[],
    phones: ['01011112222', '01033334444', '021234567'],
    emails: ['a@b.com'],
  };
  const suppressed = new Set([suppressionKey('SMS', '01011112222')]);
  const none = new Set<string>();

  it('080 거부된 특정 번호만 제외 (LMS 도 SMS 거부 적용)', () => {
    expect(isRecipientBlocked(contact, 'SMS', '01011112222', suppressed)).toBe(true);
    expect(isRecipientBlocked(contact, 'LMS', '01011112222', suppressed)).toBe(true);
    expect(isRecipientBlocked(contact, 'SMS', '01033334444', suppressed)).toBe(false);
    expect(activeRecipients(contact, 'SMS', suppressed)).toEqual(['01033334444', '021234567']);
  });

  it('카카오는 휴대폰만, SMS 거부 번호도 제외', () => {
    expect(activeRecipients(contact, 'KAKAO', suppressed)).toEqual(['01033334444']);
  });

  it('억제 목록은 연락처와 독립 — 다른 연락처 문서라도 같은 값이면 제외', () => {
    const duplicate = { ...contact, phones: ['01011112222'] };
    expect(activeRecipients(duplicate, 'SMS', suppressed)).toEqual([]);
  });

  it('채널 전체 거부 / 연락처 전체 거부', () => {
    expect(activeRecipients({ ...contact, unsubscribedChannels: ['EMAIL'] }, 'EMAIL', none)).toEqual([]);
    expect(activeRecipients({ ...contact, isUnsubscribed: true }, 'SMS', none)).toEqual([]);
    expect(activeRecipients(contact, 'EMAIL', none)).toEqual(['a@b.com']);
    expect(activeRecipients(contact, 'EMAIL', new Set([suppressionKey('EMAIL', 'a@b.com')]))).toEqual([]);
  });
});
