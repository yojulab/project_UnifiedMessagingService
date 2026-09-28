/** RFC 4180 CSV 셀 이스케이프 + 수식 인젝션 방지 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(cells: unknown[]): string {
  return `${cells.map(csvCell).join(',')}\r\n`;
}

/** 엑셀 한글 호환을 위해 UTF-8 BOM 을 붙인 스트리밍 CSV 응답 */
export function csvResponse(fileName: string, header: string[], rows: AsyncIterable<unknown[]>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(enc.encode(`﻿${csvLine(header)}`));
      for await (const r of rows) controller.enqueue(enc.encode(csvLine(r)));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // RFC 6266: ASCII 대체 filename + UTF-8 filename* 를 함께 제공
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
