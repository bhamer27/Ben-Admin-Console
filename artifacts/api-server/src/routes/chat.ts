import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { existsSync } from "fs";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Load memory.md as system context — read from disk if running on the droplet,
// otherwise fall back to the KOWALSKI_MEMORY env var (base64 or plain text).
function loadMemory(): string {
  // Try local file first (works when app runs on the same droplet as Kowalski)
  const localPaths = [
    "/root/.openclaw/memory.md",
    process.env.MEMORY_PATH ?? "",
  ].filter(Boolean);

  for (const p of localPaths) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch {
        // fall through
      }
    }
  }

  // Fallback: env var (set KOWALSKI_MEMORY in Replit Secrets as the full text)
  if (process.env.KOWALSKI_MEMORY) {
    return process.env.KOWALSKI_MEMORY;
  }

  return "(memory.md not available — running without full context)";
}

const SYSTEM_PROMPT = `You are Kowalski, Ben Hamer's AI assistant. You have full context about Ben, his projects, and his business via the memory file below. You are connected directly from Ben's admin console. Be concise, direct, and helpful — no filler words. You know everything in this memory and should use it proactively.

--- MEMORY START ---
${loadMemory()}
--- MEMORY END ---`;

// Background: notify Kowalski's hook endpoint to log this conversation to memory.md
async function notifyKowalski(userMsg: string, assistantReply: string, tab: string) {
  const hookUrl = process.env.KOWALSKI_URL;
  const hookToken = process.env.KOWALSKI_TOKEN;
  if (!hookUrl || !hookToken) return;

  const summary = `[BenAdmin chat – tab: ${tab}]\nUser: ${userMsg}\nKowalski: ${assistantReply.slice(0, 500)}${assistantReply.length > 500 ? "..." : ""}`;

  try {
    await fetch(hookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hookToken}`,
      },
      body: JSON.stringify({
        message: `Log this BenAdmin conversation to memory if significant:\n\n${summary}`,
        agentId: "main",
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Best-effort — don't block the response
  }
}

router.post("/chat", async (req: Request, res: Response) => {
  const { messages, tabContext } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    tabContext?: { tab: string; data?: unknown };
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages required" });
    return;
  }

  const tab = tabContext?.tab ?? "unknown";
  const tabData = tabContext?.data ? `\n\nCurrent tab data:\n${JSON.stringify(tabContext.data, null, 2)}` : "";

  // Build system prompt with tab context appended
  const systemPrompt = SYSTEM_PROMPT + tabData;

  // Strip any empty messages and ensure valid roles
  const cleanedMessages = messages
    .filter((m) => m.content?.trim())
    .map((m) => ({ role: m.role, content: m.content }));

  if (cleanedMessages.length === 0) {
    res.status(400).json({ error: "no valid messages" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let fullReply = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: cleanedMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const delta = event.delta.text;
        fullReply += delta;
        res.write(`data: ${JSON.stringify({ type: "text", delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

    // Fire-and-forget: log conversation to Kowalski memory
    const userMsg = cleanedMessages.filter((m) => m.role === "user").pop()?.content ?? "";
    notifyKowalski(userMsg, fullReply, tab).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
    res.end();
  }
});

export default router;
