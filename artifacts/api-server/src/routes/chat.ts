import { Router, type IRouter, type Request, type Response } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GITHUB_PAT     = process.env.GITHUB_PAT ?? "";
const GITHUB_RAW     = "https://raw.githubusercontent.com/bhamer27/kowalski-bible/main";
const HISTORY_DIR    = process.env.CHAT_HISTORY_DIR ?? "./chat-history";

// ─── Chat history ─────────────────────────────────────────────────────────────
interface StoredMessage { role: "user" | "assistant"; content: string; ts: number; }

function ensureDir(d: string) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function historyPath(tab: string) {
  ensureDir(HISTORY_DIR);
  return join(HISTORY_DIR, `${tab.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`);
}
function loadHistory(tab: string): StoredMessage[] {
  try { return JSON.parse(readFileSync(historyPath(tab), "utf-8")) as StoredMessage[]; }
  catch { return []; }
}
function saveHistory(tab: string, msgs: StoredMessage[]) {
  try { writeFileSync(historyPath(tab), JSON.stringify(msgs.slice(-100), null, 2)); } catch { /* ok */ }
}

// ─── Fetch files from kowalski-bible on GitHub ────────────────────────────────
const fileCache: Record<string, { content: string; fetchedAt: number }> = {};

async function fetchBibleFile(path: string): Promise<string> {
  const cached = fileCache[path];
  if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) return cached.content;
  try {
    const headers: Record<string, string> = { "User-Agent": "BenAdmin/1.0" };
    if (GITHUB_PAT) headers["Authorization"] = `token ${GITHUB_PAT}`;
    const r = await fetch(`${GITHUB_RAW}/${path}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return "";
    const content = await r.text();
    fileCache[path] = { content, fetchedAt: Date.now() };
    return content;
  } catch { return ""; }
}

// Map tab names to relevant project files
function projectFileForTab(tab: string): string | null {
  const t = tab.toLowerCase();
  if (t.includes("tars") || t.includes("trading") || t.includes("stock")) return "projects/TARS.md";
  if (t.includes("kalshi")) return "projects/KALSHI.md";
  return null;
}

async function buildSystemPrompt(tab: string): Promise<string> {
  const [memory, globalRules, projectFile] = await Promise.all([
    fetchBibleFile("memory.md"),
    fetchBibleFile("GLOBAL-RULES.md"),
    projectFileForTab(tab) ? fetchBibleFile(projectFileForTab(tab)!) : Promise.resolve(""),
  ]);

  return `You are Kowalski, Ben Hamer's AI assistant running inside BenAdmin.
You have full context about Ben, his projects, and his business from the files below.
Be concise, direct, and helpful. No filler. Current tab: ${tab}.

${globalRules ? `## GLOBAL RULES\n${globalRules}\n` : ""}
${memory ? `## MEMORY & CONTEXT\n${memory}\n` : ""}
${projectFile ? `## PROJECT CONTEXT (${tab})\n${projectFile}\n` : ""}`;
}

// ─── GET /api/chat/history ────────────────────────────────────────────────────
router.get("/chat/history", (req: Request, res: Response) => {
  res.json(loadHistory((req.query.tab as string) || "overview"));
});

// ─── DELETE /api/chat/history ─────────────────────────────────────────────────
router.delete("/chat/history", (req: Request, res: Response) => {
  saveHistory((req.query.tab as string) || "overview", []);
  res.json({ ok: true });
});

// ─── POST /api/chat ────────────────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response) => {
  const { messages, tabContext } = req.body as {
    messages: { role: string; content: string }[];
    tabContext?: { tab: string; data?: unknown };
  };

  if (!messages?.length) { res.status(400).json({ error: "messages required" }); return; }

  const tab      = tabContext?.tab ?? "overview";
  const lastUser = messages.filter(m => m.role === "user").pop()?.content ?? "";
  const tabNote  = tabContext?.data ? `\n\n[Tab data: ${JSON.stringify(tabContext.data)}]` : "";
  const sentAt   = Date.now();

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sse = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const systemPrompt = await buildSystemPrompt(tab);

    // Build message history for context (last 10 exchanges)
    const history = loadHistory(tab).slice(-20);
    const contextMessages = history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Add current message
    contextMessages.push({ role: "user", content: lastUser + tabNote });

    let fullReply = "";

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: contextMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const delta = event.delta.text;
        fullReply += delta;
        sse({ type: "text", delta });
      }
    }

    // Persist to history
    const updatedHistory = loadHistory(tab);
    updatedHistory.push({ role: "user",      content: lastUser, ts: sentAt });
    updatedHistory.push({ role: "assistant", content: fullReply, ts: Date.now() });
    saveHistory(tab, updatedHistory);

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
