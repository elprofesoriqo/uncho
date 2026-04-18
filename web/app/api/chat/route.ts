// Stub route — real AI backend will be wired up externally.
// Returns a streamed plain-text placeholder so the UI chat flow works during development.

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const last = messages?.at(-1)?.content ?? '';

  const reply = `[Lighthouse OS] Query received: "${last}". Backend AI integration pending — this response is a development stub. Your request has been logged to the OCHA ops queue.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Emit as AI SDK data-stream format: 0:"chunk"\n
      for (const word of reply.split(' ')) {
        controller.enqueue(encoder.encode(`0:"${word} "\n`));
      }
      // Signal done
      controller.enqueue(encoder.encode('d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}
