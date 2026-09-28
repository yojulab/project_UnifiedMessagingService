import { describe, expect, it } from 'vitest';
import { buildEmailBody, buildSmsBody, decideSmsType, resolveTemplate, smsByteLength } from './template';

describe('resolveTemplate', () => {
  it('기본 태그 + customFields 치환, 모르는 태그 유지', () => {
    const r = resolveTemplate('{name}님 ({company}/{department}) {grade} {unknown}', {
      name: '이관열',
      company: 'LEMON.IT',
      department: '대표',
      customFields: { grade: 'VIP' },
    });
    expect(r).toBe('이관열님 (LEMON.IT/대표) VIP {unknown}');
  });
});

describe('SMS 바이트/유형', () => {
  it('한글 2바이트', () => {
    expect(smsByteLength('가a')).toBe(3);
    expect(decideSmsType('가'.repeat(45))).toBe('SMS');
    expect(decideSmsType('가'.repeat(46))).toBe('LMS');
  });
});

describe('buildSmsBody', () => {
  it('광고 표기와 080 문구 삽입', () => {
    expect(buildSmsBody('안녕하세요', { isAd: true, optOutNumber: '080-123-4567' })).toBe('(광고) 안녕하세요\n(무료수신거부: 080-123-4567)');
  });
  it('이미 포함되어 있으면 중복 삽입하지 않음', () => {
    const body = '(광고) 할인\n무료거부 0801234567';
    expect(buildSmsBody(body, { isAd: true, optOutNumber: '080-123-4567' })).toBe(body);
  });
  it('광고인데 080 번호 없으면 에러', () => {
    expect(() => buildSmsBody('x', { isAd: true, optOutNumber: '' })).toThrow('080');
  });
  it('비광고는 그대로', () => {
    expect(buildSmsBody(' 안내 ', { isAd: false })).toBe('안내');
  });
});

describe('buildEmailBody', () => {
  it('텍스트 본문은 escape 후 푸터 링크 추가', () => {
    const r = buildEmailBody('<b>hi</b>', { isHtml: false, unsubUrl: 'http://x/unsubscribe?token=t' });
    expect(r.html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(r.html).toContain('href="http://x/unsubscribe?token=t"');
    expect(r.text).toContain('수신거부: http://x/unsubscribe?token=t');
  });
});
