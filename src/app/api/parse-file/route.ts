import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startMs = Date.now();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.log('[parse-file] ERROR: no file');
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`[parse-file] START "${file.name}" type=${file.type} size=${file.size}`);
    const buffer = new Uint8Array(await file.arrayBuffer());

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      console.log(`[parse-file] extracting PDF text...`);
      const { extractText } = await import('unpdf');
      const { text } = await extractText(buffer);
      const elapsed = Date.now() - startMs;
      console.log(`[parse-file] DONE "${file.name}" extractedLen=${text?.length ?? 0} (${elapsed}ms)`);
      return Response.json({ content: text || '' });
    }

    const text = new TextDecoder().decode(buffer);
    console.log(`[parse-file] DONE "${file.name}" textLen=${text.length} (${Date.now() - startMs}ms)`);
    return Response.json({ content: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'File parse error';
    console.log(`[parse-file] ERROR: ${msg} (${Date.now() - startMs}ms)`);
    return Response.json({ error: msg }, { status: 500 });
  }
}
