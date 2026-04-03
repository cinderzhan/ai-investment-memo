import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const { extractText } = await import('unpdf');
      const { text } = await extractText(buffer);
      console.log(`[parse-file] PDF "${file.name}" size=${buffer.length} extractedLen=${text?.length ?? 0}`);
      return Response.json({ content: text || '' });
    }

    // For text-based files, decode as UTF-8
    const text = new TextDecoder().decode(buffer);
    return Response.json({ content: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'File parse error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
