import type { NextRequest } from 'next/server';
import { AppError } from '@/lib/api';
import { FileParseError, parseFile, type ParsedFile } from '@/lib/parsers/fileParser';

export async function readUpload(req: NextRequest): Promise<{ form: FormData; fileName: string; parsed: ParsedFile }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError(400, 'INVALID_FORM', 'multipart/form-data 요청이 아닙니다.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw new AppError(400, 'FILE_REQUIRED', '파일을 선택하세요.');
  try {
    const parsed = parseFile(Buffer.from(await file.arrayBuffer()), file.name);
    return { form, fileName: file.name, parsed };
  } catch (err) {
    if (err instanceof FileParseError) throw new AppError(400, 'PARSE_ERROR', err.message);
    throw err;
  }
}
