export type ParsedConfig = Record<string, string>;

/** API_KEY / api-key / ApiKey / apiKey → apiKey */
export function toCamelCase(key: string): string {
  const trimmed = key.trim();
  if (!/[_\-\s]/.test(trimmed)) {
    // 이미 camelCase / PascalCase / UPPER 단어 하나
    if (trimmed === trimmed.toUpperCase()) return trimmed.toLowerCase();
    return trimmed[0].toLowerCase() + trimmed.slice(1);
  }
  const parts = trimmed.toLowerCase().split(/[_\-\s]+/).filter(Boolean);
  return parts.map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1))).join('');
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** JSON 객체 또는 KEY=VALUE / KEY: VALUE (줄 단위) 텍스트를 파싱한다. 키는 camelCase 로 정규화. */
export function parseConfigText(raw: string): ParsedConfig {
  const text = raw.trim();
  if (!text) return {};
  if (text.startsWith('[')) throw new Error('JSON 객체 형식이 아닙니다.');
  if (text.startsWith('{')) {
    let obj: unknown;
    try {
      obj = JSON.parse(text);
    } catch {
      throw new Error('JSON 형식이 올바르지 않습니다.');
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new Error('JSON 객체 형식이 아닙니다.');
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamelCase(k), stringify(v).trim()]));
  }
  const result: ParsedConfig = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^export\s+/, '');
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const idx = trimmed.search(/[=:]/);
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/,$/, '')
      .replace(/^["']|["']$/g, '');
    result[toCamelCase(key)] = value;
  }
  return result;
}

export interface TemplateCheck {
  missing: string[];
  unknown: string[];
}

const PROVIDER_PREFIX_RE = /^(zoho|aws|ses|aligo|solapi|mail|email|sms|lms|kakao)[_\-\s]?/i;

const ALIAS_MAP: Record<string, string> = {
  fromemail: 'senderAddress',
  senderemail: 'senderAddress',
  fromaddress: 'senderAddress',
  senderaddress: 'senderAddress',
  from: 'senderAddress',
  sender: 'senderAddress',
  fromphone: 'senderNumber',
  senderphone: 'senderNumber',
  callerid: 'senderNumber',
  fromnumber: 'senderNumber',
  sendernumber: 'senderNumber',
  sendphone: 'senderNumber',
  key: 'apiKey',
  apikey: 'apiKey',
  apisecret: 'apiSecret',
  clientid: 'clientId',
  clientsecret: 'clientSecret',
  refreshtoken: 'refreshToken',
  accountid: 'accountId',
  accesskeyid: 'accessKeyId',
  accesskey: 'accessKeyId',
  secretaccesskey: 'secretAccessKey',
  secretkey: 'secretAccessKey',
};

/** 템플릿의 실제 키로 매핑 (공급사 접두어 제거 및 별칭 해석) */
export function resolveConfigKey(rawKey: string, template: Record<string, unknown>): string {
  if (rawKey in template) return rawKey;
  const camel = toCamelCase(rawKey);
  if (camel in template) return camel;

  const lower = rawKey.toLowerCase().replace(/[_\-\s]/g, '');
  for (const tKey of Object.keys(template)) {
    if (tKey.toLowerCase() === lower) return tKey;
  }

  // 접두어 제거 후 비교 (예: zohoClientId -> clientId)
  const stripped = rawKey.replace(PROVIDER_PREFIX_RE, '');
  const strippedCamel = toCamelCase(stripped);
  if (strippedCamel in template) return strippedCamel;

  const strippedLower = stripped.toLowerCase().replace(/[_\-\s]/g, '');
  for (const tKey of Object.keys(template)) {
    if (tKey.toLowerCase() === strippedLower) return tKey;
  }

  // 별칭 매핑 (예: zohoFromEmail -> fromEmail -> senderAddress)
  if (ALIAS_MAP[strippedLower] && ALIAS_MAP[strippedLower] in template) {
    return ALIAS_MAP[strippedLower];
  }
  if (ALIAS_MAP[lower] && ALIAS_MAP[lower] in template) {
    return ALIAS_MAP[lower];
  }

  return camel;
}

/** 템플릿 기준으로 파싱된 설정을 매핑하고 유효성을 점검한다 */
export function matchConfigToTemplate(
  parsed: ParsedConfig,
  template: Record<string, { required: boolean }>,
): { mapped: ParsedConfig; check: TemplateCheck } {
  const mapped: ParsedConfig = {};
  const unknown: string[] = [];

  for (const [k, v] of Object.entries(parsed)) {
    const resolved = resolveConfigKey(k, template);
    if (resolved in template) {
      mapped[resolved] = v;
    } else if (v.trim()) {
      unknown.push(k);
    }
  }

  const missing = Object.entries(template)
    .filter(([k, f]) => f.required && !mapped[k]?.trim())
    .map(([k]) => k);

  return { mapped, check: { missing, unknown } };
}

export function checkAgainstTemplate(parsed: ParsedConfig, template: Record<string, { required: boolean }>): TemplateCheck {
  const { check } = matchConfigToTemplate(parsed, template);
  return check;
}
