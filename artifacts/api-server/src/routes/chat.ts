import { Router, type IRouter, type Request, type Response } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

const router: IRouter = Router();

const KOWALSKI_HOOKS_URL   = process.env.KOWALSKI_URL   ?? "http://167.71.108.57:18789/hooks/agent";
const KOWALSKI_HOOKS_TOKEN = process.env.KOWALSKI_TOKEN ?? "benadmin-hook-secret-2026";

const SESSION_KEY = (tab: string) => `benadmin:${tab.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

// ─── Dirs ─────────────────────────────────────────────────────────────
const HISTORY_DIR = process.env.CHAT_HISTORY_DIR ?? "./chat-history";
const REPLY_DIR   = "./chat-replies";

function ensureDir(d: string) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

// ─── Chat history ─────────────────────────────────────────────────────
interface StoredMessage { role: "user" | "assistant"; content: string; ts: number; }

function historyPath(tab: string) {
  ensureDir(HISTORY_DIR);
  return join(HISTORY_DIR, `${tab.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`);
}
function loadHistory(tab: string): StoredMessage[] {
  try { return JSON.parse(readFileSync(historyPath(tab), "utf-8")) as StoredMessage[]; }
  catch { return []; }
}
function saveHistory(tab: string, msgs: StoredMessage[]) {
  try { writeFileSync(historyPath(tab), JSON.stringify(msgs.slice(-100), null, 2)); } catch { /* non-fatal */ }
}

// ─── Reply store (temp files, keyed by runId) ─────────────────────────
// Kowalski POSTs reply to /api/chat/reply — SSE stream polls for it
function replyPath(runId: string) {
  ensureDir(REPLY_DIR);
  return join(REPLY_DIR, `${runId}.json`);
}
function storeReply(runId: string, text: string) {
  writeFileSync(replyPath(runId), JSON.stringify({ text, ts: Date.now() }));
}
function readReply(runId: string): string | null {
  try {
    const p = replyPath(runId);
    if (!existsSync(p)) return null;
    const d = JSON.parse(readFileSync(p, "utf-8")) as { text: string };
    return d.text ?? null;
  } catch { return null; }
}
function deleteReply(runId: string) {
  try { unlinkSync(replyPath(runId)); } catch { /* ok */ }
}

// Poll for reply file, timeout after maxWaitMs
async function pollForReply(runId: string, maxWaitMs = 28000): Promise<string | null> {
  const start    = Date.now();
  const interval = 1200;
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, interval));
    const reply = readReply(runId);
    if (reply) { deleteReply(runId); return reply; }
  }
  return null;
}

// ─── GET /api/chat/history ────────────────────────────────────────────
router.get("/chat/history", (req: Request, res: Response) => {
  res.json(loadHistory((req.query.tab as string) || "overview"));
});

// ─── DELETE /api/chat/history ─────────────────────────────────────────
router.delete("/chat/history", (req: Request, res: Response) => {
  const tab = (req.query.tab as string) || "overview";
  saveHistory(tab, []);
  res.json({ ok: true });
});

// ─── POST /api/chat/reply — Kowalski pushes reply here ────────────────
// Kowalski calls this endpoint with the reply text, keyed by runId
router.post("/chat/reply", (req: Request, res: Response) => {
  const { runId, text, token } = req.body as { runId?: string; text?: string; token?: string };

  // Simple shared secret check
  if (token !== (process.env.KOWALSKI_TOKEN ?? "benadmin-hook-secret-2026")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!runId || !text) {
    res.status(400).json({ error: "runId and text required" });
    return;
  }
  storeReply(runId, text);
  res.json({ ok: true });
});

// ─── POST /api/chat ────────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response) => {
  const { messages, tabContext } = req.body as {
    messages: { role: string; content: string }[];
    tabContext?: { tab: string; data?: unknown };
  };

  if (!messages?.length) { res.status(400).json({ error: "messages required" }); return; }

  const tab      = tabContext?.tab ?? "overview";
  const sessionKey = SESSION_KEY(tab);
  const lastUser = messages.filter(m => m.role === "user").pop()?.content ?? "";
  const tabNote  = tabContext?.data
    ? `\n\n[BenAdmin — tab: ${tab}]\n${JSON.stringify(tabContext.data, null, 2)}`
    : `\n\n[BenAdmin — tab: ${tab}]`;

  // Build the callback URL — Kowalski will POST the reply here
  const host        = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const proto       = req.headers["x-forwarded-proto"] ?? "https";
  const callbackUrl = `${proto}://${host}/api/chat/reply`;

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sse    = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const sentAt = Date.now();

  try {
    // Fire to Kowalski — include callback URL and token in the message
    // Kowalski will POST reply to callbackUrl when done
    const fullMessage = lastUser + tabNote +
      `\n\n[REPLY_CALLBACK url="${callbackUrl}" runId="{runId}" token="${KOWALSKI_HOOKS_TOKEN}"]`;

    const hookRes = await fetch(KOWALSKI_HOOKS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KOWALSKI_HOOKS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: lastUser + tabNote,
        agentId: "main",
        sessionKey,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!hookRes.ok) {
      sse({ type: "text", delta: "Couldn't reach Kowalski. Try again." });
      sse({ type: "done" }); res.end(); return;
    }

    const hookData = await hookRes.json() as { ok: boolean; runId?: string };
    const runId    = hookData.runId ?? `fallback-${sentAt}`;

    sse({ type: "text", delta: "" }); // signal start to UI

    // Poll for the reply file
    const reply = await pollForReply(runId);
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
    history.push({ role: "user",      content: lastUser,   ts: sentAt });
    history.push({ role: "assistant", content: finalReply, ts: Date.now() });
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
