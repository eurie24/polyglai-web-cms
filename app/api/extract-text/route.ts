import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';
import mammoth from 'mammoth';

// Lazy import to avoid edge/unsupported environments
let pdfParse: any;
async function getPdfParser() {
  if (pdfParse) return pdfParse;
  try {
    // Try canonical entry
    const mod = await import('pdf-parse');
    pdfParse = (mod as any).default || (mod as any);
    return pdfParse;
  } catch (e1) {
    // eslint-disable-next-line no-console
    console.error('pdf-parse import failed (main). Trying legacy path...', e1);
    try {
      // Fallback to explicit file path
      const mod2 = await import('pdf-parse/lib/pdf-parse.js');
      pdfParse = (mod2 as any).default || (mod2 as any);
      return pdfParse;
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.error('pdf-parse import failed (legacy).', e2);
      throw e2;
    }
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line no-console
    console.log('extract-text API: received request');
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const filename = (file.name || '').toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // RTF handling (simple converter)
    if (filename.endsWith('.rtf') || (file.type && file.type === 'application/rtf')) {
      const raw = iconv.decode(buffer, 'latin1');
      const text = simpleRtfToText(raw).trim();
      if (text.length === 0) {
        return NextResponse.json({ error: 'No extractable text in RTF' }, { status: 422 });
      }
      if (text.length > 1000) {
        return NextResponse.json({ error: 'RTF text exceeds 1000 characters' }, { status: 413 });
      }
      return NextResponse.json({ text });
    }

    // DOCX handling
    if (filename.endsWith('.docx') || (file.type && (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type === 'application/docx'))) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        let text: string = (result?.value || '').trim();
        if (!text) {
          return NextResponse.json({ error: 'No extractable text in DOCX' }, { status: 422 });
        }
        if (text.length > 1000) {
          return NextResponse.json({ error: 'DOCX text exceeds 1000 characters' }, { status: 413 });
        }
        return NextResponse.json({ text });
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('DOCX parse failed:', err?.message || err);
        return NextResponse.json({ error: 'Failed to parse DOCX' }, { status: 500 });
      }
    }

    // TXT handling
    if (filename.endsWith('.txt') || (file.type && file.type === 'text/plain')) {
      // Try UTF-8 first; if fails, fallback to latin1
      let text = buffer.toString('utf8');
      if (/\uFFFD/.test(text)) {
        text = iconv.decode(buffer, 'latin1');
      }
      text = text.trim();
      if (text.length > 1000) {
        return NextResponse.json({ error: 'Text exceeds 1000 characters' }, { status: 413 });
      }
      return NextResponse.json({ text });
    }

    // PDF handling with limits: 1 page, <= 1000 chars
    if (filename.endsWith('.pdf') || (file.type && file.type === 'application/pdf')) {
      try {
        const parse = await getPdfParser();
        // Disable page render to speed up and avoid worker requirements
        const data = await parse(buffer, { max: 1 }).catch((err: any) => {
          // eslint-disable-next-line no-console
          console.error('pdf-parse threw:', err);
          throw err;
        });
        const text: string = (data?.text || '').trim();
        const numPages: number = data?.numpages || data?.numPages || 0;
        if (numPages > 1) {
          return NextResponse.json({ error: 'PDF has more than 1 page' }, { status: 413 });
        }
        if (text.length > 1000) {
          return NextResponse.json({ error: 'PDF text exceeds 1000 characters' }, { status: 413 });
        }
        if (!text) {
          return NextResponse.json({ error: 'No extractable text in PDF' }, { status: 422 });
        }
        return NextResponse.json({ text });
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('PDF parse failed:', err?.message || err);
        const msg = typeof err?.message === 'string' ? err.message : 'Failed to parse PDF';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Unsupported file type. Upload .txt or .pdf' }, { status: 400 });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('extract-text API error:', e);
    const message = typeof e?.message === 'string' ? e.message : 'Failed to extract text';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Minimal RTF to text converter: strips control words/groups and decodes \uN escapes
function simpleRtfToText(rtf: string): string {
  // Replace unicode escapes like \u1234? with the corresponding char
  let text = rtf.replace(/\\u(-?\d+)[^\d]/g, (_m, code) => {
    const n = parseInt(code, 10);
    try {
      return String.fromCharCode(n < 0 ? 65536 + n : n);
    } catch {
      return '';
    }
  });
  // Remove RTF control words (e.g., \par, \b0)
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');
  // Remove groups { ... }
  text = text.replace(/[{}]/g, '');
  // Decode escaped special chars \\ \{ \}
  text = text.replace(/\\\\/g, '\\').replace(/\\\{/g, '{').replace(/\\\}/g, '}');
  // Normalize newlines for \par that may remain
  text = text.replace(/\s*par\s*/g, '\n');
  return text;
}


