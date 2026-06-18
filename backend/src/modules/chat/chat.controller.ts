import type { Request, Response } from "express";
import { z } from "zod";
import * as chatService from "./chat.service";
import { logger } from "../../utils/logger";

const askSchema = z.object({
  question: z.string().min(1, "Question must not be empty").max(4000),
});

/**
 * POST /api/conversations/:id/messages
 * Streams the answer as Server-Sent Events:
 *   event: sources → { sources }
 *   event: token   → { text }
 *   event: done    → { messageId, model }
 *   event: error   → { message }
 * The frontend consumes this via fetch + ReadableStream (so it can send the
 * Authorization header, which EventSource cannot).
 */
export async function ask(req: Request, res: Response) {
  const { question } = askSchema.parse(req.body);
  const userId = req.user!.id;
  const conversationId = req.params.id!;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering (nginx/Render)
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await chatService.askStream(
      userId,
      conversationId,
      question,
      {
        onSources: (sources) => send("sources", { sources }),
        onToken: (text) => send("token", { text }),
      },
    );
    send("done", result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate answer";
    logger.error("Streaming chat failed", { conversationId, message });
    // If headers/body already started, we can only emit an SSE error event.
    send("error", { message });
  } finally {
    res.end();
  }
}
