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

export function checkAgainstTemplate(parsed: ParsedConfig, template: Record<string, { required: boolean }>): TemplateCheck {
  const missing = Object.entries(template)
    .filter(([k, f]) => f.required && !parsed[k]?.trim())
    .map(([k]) => k);
  const unknown = Object.keys(parsed).filter((k) => !(k in template));
  return { missing, unknown };
}
