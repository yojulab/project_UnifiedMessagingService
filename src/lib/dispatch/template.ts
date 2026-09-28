export const SMS_MAX_BYTES = 90;
export const LMS_MAX_BYTES = 2000;

/** EUC-KR 기준 바이트 수 (한글 등 비 ASCII 2바이트) */
export function smsByteLength(text: string): number {
  let n = 0;
  for (const ch of text) n += (ch.codePointAt(0) ?? 0) > 0x7f ? 2 : 1;
  return n;
}

export function decideSmsType(text: string): 'SMS' | 'LMS' {
  return smsByteLength(text) <= SMS_MAX_BYTES ? 'SMS' : 'LMS';
}

export interface TemplateContact {
  name: string;
  company?: string | null;
  department?: string | null;
  customFields?: Record<string, unknown> | null;
}

export const TEMPLATE_TAGS = ['{name}', '{company}', '{department}'] as const;

/** {name} {company} {department} 및 customFields 키 치환 */
export function resolveTemplate(template: string, c: TemplateContact): string {
  const vars: Record<string, string> = {
    name: c.name ?? '',
    company: c.company ?? '',
    department: c.department ?? '',
  };
  for (const [k, v] of Object.entries(c.customFields ?? {})) {
    if (!(k in vars)) vars[k] = v === null || v === undefined ? '' : String(v);
  }
  return template.replace(/\{([^{}\s]+)\}/g, (m, key: string) => (key in vars ? vars[key] : m));
}

export function optOutLine(optOutNumber: string): string {
  return `(무료수신거부: ${optOutNumber})`;
}

/** 문자 본문 구성: 광고 표기 + 080 수신거부 문구 자동 삽입(중복 방지) */
export function buildSmsBody(body: string, opts: { isAd: boolean; optOutNumber?: string | null }): string {
  let text = body.trim();
  if (!opts.isAd) return text;
  if (!opts.optOutNumber) throw new Error('광고 문자에는 080 수신거부 번호 설정이 필요합니다.');
  if (!text.startsWith('(광고)')) text = `(광고) ${text}`;
  const digits = opts.optOutNumber.replace(/\D/g, '');
  if (!text.replace(/\D/g, '').includes(digits)) text = `${text}\n${optOutLine(opts.optOutNumber)}`;
  return text;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function emailFooterHtml(unsubUrl: string): string {
  return `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd"/><p style="font-size:12px;color:#888">본 메일은 수신에 동의하신 분께 발송되었습니다. 수신을 원하지 않으시면 <a href="${escapeHtml(unsubUrl)}">여기를 클릭</a>하여 수신거부 하실 수 있습니다.</p>`;
}

/** 이메일 HTML/텍스트 본문 + 수신거부 푸터 */
export function buildEmailBody(body: string, opts: { isHtml: boolean; unsubUrl: string }): { html: string; text: string } {
  const html = opts.isHtml ? body : `<div style="white-space:pre-wrap">${escapeHtml(body)}</div>`;
  const plain = opts.isHtml ? body.replace(/<[^>]+>/g, '') : body;
  return {
    html: `${html}${emailFooterHtml(opts.unsubUrl)}`,
    text: `${plain}\n\n---\n수신거부: ${opts.unsubUrl}`,
  };
}
