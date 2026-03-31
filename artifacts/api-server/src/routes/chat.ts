import { Router, type IRouter, type Request, type Response } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const router: IRouter = Router();

const KOWALSKI_HOOKS_URL   = process.env.KOWALSKI_URL      ?? "http://167.71.108.57:18789/hooks/agent";
const KOWALSKI_HOOKS_TOKEN = process.env.KOWALSKI_TOKEN    ?? "benadmin-hook-secret-2026";
const KOWALSKI_GW_URL      = process.env.KOWALSKI_GW_URL   ?? "http://167.71.108.57:18789";
const KOWALSKI_GW_TOKEN    = process.env.KOWALSKI_GW_TOKEN ?? "6528e52e789a282727b3d227eb1f283742032c7cca9bc6878bc0782e93cd755e";

// Dedicated session key per tab — isolated from Discord, no notifications to Andi
const SESSION_KEY = (tab: string) => `benadmin:${tab.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

// ─── Chat history persistence ─────────────────────────────────────────
const HISTORY_DIR = process.env.CHAT_HISTORY_DIR ?? "./chat-history";

interface StoredMessage { role: "user" | "assistant"; content: string; ts: number; }

function historyPath(tab: string) {
  if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });
  return join(HISTORY_DIR, `${tab.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`);
}

function loadHistory(tab: string): StoredMessage[] {
  try {
    return JSON.parse(readFileSync(historyPath(tab), "utf-8")) as StoredMessage[];
  } catch { return []; }
}

function saveHistory(tab: string, messages: StoredMessage[]) {
  try {
    // Keep last 100 messages per tab
    const trimmed = messages.slice(-100);
    writeFileSync(historyPath(tab), JSON.stringify(trimmed, null, 2));
  } catch { /* non-fatal */ }
}

// ─── Transcript polling ───────────────────────────────────────────────
async function waitForReply(sessionKey: string, afterMs: number, maxWaitMs = 28000): Promise<string | null> {
  const start    = Date.now();
  const interval = 1500;

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, interval));
    try {
      // List sessions to find our benadmin session transcript path
      const r = await fetch(`${KOWALSKI_GW_URL}/tools/invoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KOWALSKI_GW_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool: "sessions_list", args: {}, sessionKey }),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) continue;

      const data = await r.json() as {
        ok: boolean;
        result?: { details?: { sessions?: { key: string; transcriptPath?: string; status?: string; updatedAt?: number }[] } };
      };

      const sessions = data?.result?.details?.sessions ?? [];
      const our = sessions.find(s => s.key === `agent:main:${sessionKey}` || s.key.includes(sessionKey));
      if (!our?.transcriptPath) continue;
      if (our.status === "running") continue; // still processing

      // Read the transcript
      const tr = await fetch(`${KOWALSKI_GW_URL}/tools/invoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KOWALSKI_GW_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool: "read", args: { file: our.transcriptPath, limit: 10 } }),
        signal: AbortSignal.timeout(6000),
      });
      if (!tr.ok) continue;

      const td   = await tr.json() as { ok: boolean; result?: { content?: { type: string; text: string }[] } };
      const text = td?.result?.content?.[0]?.text ?? "";
      const lines = text.split("\n").filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]) as { role?: string; content?: unknown; timestamp?: number };
          const ts    = entry.timestamp ?? 0;
          if (entry.role === "assistant" && (ts === 0 || ts > afterMs)) {
            const c = entry.content;
            if (typeof c === "string") return c;
            if (Array.isArray(c)) {
              const t = c.filter((x: {type?:string}) => x.type === "text").map((x: {text?:string}) => x.text ?? "").join("");
              if (t) return t;
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* keep polling */ }
  }
  return null;
}

// ─── GET /api/chat/history?tab=xxx ────────────────────────────────────
router.get("/chat/history", (req: Request, res: Response) => {
  const tab = (req.query.tab as string) || "overview";
  res.json(loadHistory(tab));
});

// ─── DELETE /api/chat/history?tab=xxx ────────────────────────────────
router.delete("/chat/history", (req: Request, res: Response) => {
  const tab = (req.query.tab as string) || "overview";
  saveHistory(tab, []);
  res.json({ ok: true });
});

// ─── POST /api/chat ────────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response) => {
  const { messages, tabContext } = req.body as {
    messages: { role: string; content: string }[];
    tabContext?: { tab: string; data?: unknown };
  };

  if (!messages?.length) { res.status(400).json({ error: "messages required" }); return; }

  const tab        = tabContext?.tab ?? "overview";
  const sessionKey = SESSION_KEY(tab);
  const lastUser   = messages.filter(m => m.role === "user").pop()?.content ?? "";
  const tabNote    = tabContext?.data
    ? `\n\n[BenAdmin — tab: ${tab}]\n${JSON.stringify(tabContext.data, null, 2)}`
    : `\n\n[BenAdmin — tab: ${tab}]`;

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sse    = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const sentAt = Date.now();

  try {
    const hookRes = await fetch(KOWALSKI_HOOKS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KOWALSKI_HOOKS_TOKEN}`,
        "Content-Type": "application/json",
      },
      // sessionKey isolates BenAdmin from Discord — no notifications to Andi
      body: JSON.stringify({ message: lastUser + tabNote, agentId: "main", sessionKey }),
      signal: AbortSignal.timeout(8000),
    });

    if (!hookRes.ok) {
      sse({ type: "text", delta: "Couldn't reach Kowalski. Try again." });
      sse({ type: "done" }); res.end(); return;
    }

    sse({ type: "text", delta: "" });

    const reply = await waitForReply(sessionKey, sentAt);
    const finalReply = reply ?? "Got it — I'm on it.";

    // Stream word by word
    const words = finalReply.split(" ");
    for (let i = 0; i < words.length; i += 4) {
      const chunk = words.slice(i, i + 4).join(" ") + (i + 4 < words.length ? " " : "");
      sse({ type: "text", delta: chunk });
      await new Promise(r => setTimeout(r, 25));
    }

    // Persist to history
    const history = loadHistory(tab);
    history.push({ role: "user",      content: lastUser,    ts: sentAt });
    history.push({ role: "assistant", content: finalReply,  ts: Date.now() });
    saveHistory(tab, history);

    sse({ type: "done" });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sse({ type: "text", delta: `Error: ${msg}` });
    sse({ type: "done" }); res.end();
  }
});

export default router;
