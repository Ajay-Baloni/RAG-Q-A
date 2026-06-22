import type { Request, Response } from "express";
import { z } from "zod";
import * as chatService from "./chat.service";
import { logger } from "../../utils/logger";

const askSchema = z.object({
  question: z.string().min(1, "Question must not be empty").max(4000),
  // Agentic tools the user enabled for this question. Empty = plain document RAG.
  tools: z.array(z.enum(["web_search", "calculator"])).optional().default([]),
});

/**
 * POST /api/conversations/:id/messages
 * Streams the answer as Server-Sent Events:
 *   event: step        → { order, tool, input }
 *   event: tool_result → { order, summary }
 *   event: sources     → { sources }
 *   event: token       → { text }
 *   event: done        → { messageId, model, usage }
 *   event: error       → { message }
 * The frontend consumes this via fetch + ReadableStream (so it can send the
 * Authorization header, which EventSource cannot).
 */
export async function ask(req: Request, res: Response) {
  const { question, tools } = askSchema.parse(req.body);
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
      tools,
      {
        onSources: (sources) => send("sources", { sources }),
        onStep: (step) =>
          send("step", { order: step.order, tool: step.tool, input: step.input }),
        onToolResult: (order, summary) => send("tool_result", { order, summary }),
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
