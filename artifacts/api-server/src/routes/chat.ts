import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const KOWALSKI_HOOKS_URL   = process.env.KOWALSKI_URL      ?? "http://167.71.108.57:18789/hooks/agent";
const KOWALSKI_HOOKS_TOKEN = process.env.KOWALSKI_TOKEN    ?? "benadmin-hook-secret-2026";
const KOWALSKI_GW_URL      = process.env.KOWALSKI_GW_URL   ?? "http://167.71.108.57:18789";
const KOWALSKI_GW_TOKEN    = process.env.KOWALSKI_GW_TOKEN ?? "6528e52e789a282727b3d227eb1f283742032c7cca9bc6878bc0782e93cd755e";

interface SessionEntry {
  key: string;
  sessionId: string;
  channel: string;
  status: string;
  updatedAt: number;
  transcriptPath?: string;
}

// Get the latest Discord session transcript path from the gateway
async function getDiscordSessionPath(): Promise<{ path: string; updatedAt: number } | null> {
  const r = await fetch(`${KOWALSKI_GW_URL}/tools/invoke`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KOWALSKI_GW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool: "sessions_list", args: {} }),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) return null;
  const data = await r.json() as { ok: boolean; result?: { details?: { sessions?: SessionEntry[] } } };
  const sessions = data?.result?.details?.sessions ?? [];
  // Find the most recently active discord session
  const discord = sessions
    .filter(s => s.channel === "discord" && s.transcriptPath)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return discord ? { path: discord.transcriptPath!, updatedAt: discord.updatedAt } : null;
}

// Read assistant reply from transcript file after a given timestamp
async function readLatestReply(transcriptPath: string, afterMs: number, maxWaitMs = 28000): Promise<string | null> {
  const start    = Date.now();
  const interval = 1500;
  // Read transcript via tools/invoke read tool
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const r = await fetch(`${KOWALSKI_GW_URL}/tools/invoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KOWALSKI_GW_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "read",
          args: { file: transcriptPath, limit: 20 },
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) continue;

      const data  = await r.json() as { ok: boolean; result?: { content?: { type: string; text: string }[] } };
      const text  = data?.result?.content?.[0]?.text ?? "";
      const lines = text.split("\n").filter(Boolean);

      // Parse JSONL transcript lines, find assistant messages after our send time
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]) as { role?: string; content?: unknown; timestamp?: number; ts?: number };
          const ts    = entry.timestamp ?? entry.ts ?? 0;
          if (entry.role === "assistant" && (ts === 0 || ts > afterMs)) {
            const content = entry.content;
            if (typeof content === "string") return content;
            if (Array.isArray(content)) {
              const texts = content
                .filter((c: {type?:string; text?:string}) => c.type === "text")
                .map((c: {text?:string}) => c.text ?? "")
                .join("");
              if (texts) return texts;
            }
          }
        } catch { /* skip malformed lines */ }
      }
    } catch { /* keep polling */ }
  }
  return null;
}

// POST /api/chat  — relay to Kowalski via hooks, stream reply back as SSE
router.post("/chat", async (req: Request, res: Response) => {
  const { messages, tabContext } = req.body as {
    messages: { role: string; content: string }[];
    tabContext?: { tab: string; data?: unknown };
  };

  if (!messages?.length) {
    res.status(400).json({ error: "messages required" });
    return;
  }

  const tab      = tabContext?.tab ?? "unknown";
  const lastUser = messages.filter(m => m.role === "user").pop()?.content ?? "";
  const tabNote  = tabContext?.data
    ? `\n\n[BenAdmin — tab: ${tab}]\n${JSON.stringify(tabContext.data, null, 2)}`
    : `\n\n[BenAdmin — tab: ${tab}]`;

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sse = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const sentAt = Date.now();

  try {
    // Fire to Kowalski
    const hookRes = await fetch(KOWALSKI_HOOKS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KOWALSKI_HOOKS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: lastUser + tabNote, agentId: "main" }),
      signal: AbortSignal.timeout(8000),
    });

    if (!hookRes.ok) {
      sse({ type: "text", delta: "Couldn't reach Kowalski. Try again." });
      sse({ type: "done" });
      res.end();
      return;
    }

    sse({ type: "text", delta: "" }); // start signal

    // Get the transcript path to poll
    const session = await getDiscordSessionPath();
    let reply: string | null = null;

    if (session?.path) {
      reply = await readLatestReply(session.path, sentAt);
    }

    if (reply) {
      // Stream in small chunks for a natural feel
      const words = reply.split(" ");
      for (let i = 0; i < words.length; i += 4) {
        const chunk = words.slice(i, i + 4).join(" ") + (i + 4 < words.length ? " " : "");
        sse({ type: "text", delta: chunk });
        await new Promise(r => setTimeout(r, 25));
      }
    } else {
      sse({ type: "text", delta: "Sent — check Discord for my response." });
    }

    sse({ type: "done" });
    res.end();

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sse({ type: "text", delta: `Error: ${msg}` });
    sse({ type: "done" });
    res.end();
  }
});

export default router;
