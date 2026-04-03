import { NextRequest } from 'next/server';

const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  moonshot: 'https://api.moonshot.cn/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
};

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const { provider, model, apiKey, baseUrl, messages } = await request.json();

    if (!apiKey) {
      return new Response('API key is required', { status: 400 });
    }

    const safeApiKey = sanitizeHeaderValue(apiKey);

    // Anthropic uses a different API format (only for preset Anthropic provider)
    if (provider === 'anthropic' && !baseUrl) {
      return handleAnthropic(model, safeApiKey, messages);
    }

    // All others use OpenAI-compatible format
    let url: string;
    if (baseUrl) {
      // Custom or overridden base URL — append /chat/completions
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      url = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;
    } else {
      url = PROVIDER_URLS[provider] || 'https://api.openai.com/v1/chat/completions';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${safeApiKey}`,
    };

    const body = {
      model,
      messages,
      stream: true,
    };

    const encoder = new TextEncoder();
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: encoder.encode(JSON.stringify(body)),
    });

    if (!res.ok) {
      const errText = await res.text();
      const encoder = new TextEncoder();
      return new Response(encoder.encode(`Provider error: ${errText}`), {
        status: res.status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Stream the response through
    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        const encoder = new TextEncoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        } catch {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    const encoder = new TextEncoder();
    return new Response(encoder.encode(msg), {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function handleAnthropic(model: string, apiKey: string, messages: { role: string; content: string }[]) {
  // Extract system message
  const systemMsg = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens: 8192,
    stream: true,
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const encoder = new TextEncoder();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: encoder.encode(JSON.stringify(body)),
  });

  if (!res.ok) {
    const errText = await res.text();
    const encoder = new TextEncoder();
    return new Response(encoder.encode(`Anthropic error: ${errText}`), {
      status: res.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Convert Anthropic SSE to OpenAI-compatible SSE format
  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  // Convert to OpenAI format
                  const openaiChunk = {
                    choices: [{ delta: { content: parsed.delta.text } }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
        }
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
