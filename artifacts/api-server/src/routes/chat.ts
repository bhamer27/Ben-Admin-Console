import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_BASE = `You are Kowalski, Ben Hamer's AI assistant inside BenAdmin — his unified control panel.
You have full context of the current tab and live data, and can call tools to fetch fresh information.
Be direct and specific. No filler. Ben is a technical founder who knows his products well.
Current UTC time: ${new Date().toUTCString()}`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_kalshi_snapshot",
    description: "Fetch live Kalshi portfolio: balance, open positions with P&L, win rate, journal stats",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_instantly_metrics",
    description: "Fetch Instantly.ai cold email campaign metrics: sent, open rate, reply rate, campaigns list",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_stock_positions",
    description: "Fetch current stock/options positions and P&L from Tradier",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

async function executeTool(name: string): Promise<string> {
  const baseUrl = "http://localhost:" + (process.env.PORT || 3001);

  try {
    if (name === "get_kalshi_snapshot") {
      const statsUrl = process.env.KALSHI_STATS_URL;
      if (!statsUrl) return JSON.stringify({ error: "KALSHI_STATS_URL not configured" });
      const r = await fetch(statsUrl, {
        headers: { Authorization: `Bearer ${process.env.BENADMIN_TOKEN || "benhamer_internal"}` },
        signal: AbortSignal.timeout(15_000),
      });
      return JSON.stringify(await r.json(), null, 2);
    }

    if (name === "get_instantly_metrics") {
      const apiKey = process.env.INSTANTLY_API_KEY;
      if (!apiKey) return JSON.stringify({ error: "INSTANTLY_API_KEY not configured" });
      const r = await fetch("https://api.instantly.ai/api/v1/campaign/list?limit=20&skip=0", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      return JSON.stringify(await r.json(), null, 2);
    }

    if (name === "get_stock_positions") {
      const token = process.env.TRADIER_API_TOKEN;
      const account = process.env.TRADIER_ACCOUNT_ID;
      if (!token || !account) return JSON.stringify({ error: "Tradier not configured" });
      const base = process.env.TRADIER_API_URL ?? "https://api.tradier.com/v1";
      const r = await fetch(`${base}/accounts/${account}/positions`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      return JSON.stringify(await r.json(), null, 2);
    }

    return JSON.stringify({ error: "Unknown tool" });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

router.post("/chat", async (req: Request, res: Response) => {
  const { messages, tabContext } = req.body as {
    messages: Anthropic.Messages.MessageParam[];
    tabContext?: { tab: string; data?: unknown };
  };

  if (!messages?.length) {
    res.status(400).json({ error: "No messages" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY not configured", configured: false });
    return;
  }

  let system = SYSTEM_BASE;
  if (tabContext) {
    system += `\n\n## Current tab: ${tabContext.tab.toUpperCase()}`;
    if (tabContext.data) {
      system += `\n\nLive data on screen:\n\`\`\`json\n${JSON.stringify(tabContext.data, null, 2).slice(0, 4000)}\n\`\`\``;
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let currentMessages = [...messages];
    let iterations = 0;

    while (iterations < 5) {
      iterations++;
      const stream = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system,
        messages: currentMessages,
        tools: TOOLS,
        stream: true,
      });

      let fullText = "";
      let toolUses: { id: string; name: string; input: unknown }[] = [];
      let currentToolUse: { id: string; name: string } | null = null;
      let currentToolInput = "";
      let stopReason = "";

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          currentToolUse = { id: event.content_block.id, name: event.content_block.name };
          currentToolInput = "";
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            fullText += event.delta.text;
            send({ type: "text", delta: event.delta.text });
          } else if (event.delta.type === "input_json_delta") {
            currentToolInput += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop" && currentToolUse) {
          try { toolUses.push({ ...currentToolUse, input: JSON.parse(currentToolInput || "{}") }); } catch { toolUses.push({ ...currentToolUse, input: {} }); }
          currentToolUse = null;
        } else if (event.type === "message_delta") {
          stopReason = event.delta.stop_reason ?? "";
        }
      }

      if (stopReason === "tool_use" && toolUses.length > 0) {
        send({ type: "tool_call", tools: toolUses.map((t) => t.name) });

        const assistantContent: Anthropic.Messages.ContentBlock[] = [];
        if (fullText) assistantContent.push({ type: "text", text: fullText });
        toolUses.forEach((t) => assistantContent.push({ type: "tool_use", id: t.id, name: t.name, input: t.input as Record<string, unknown> }));
        currentMessages.push({ role: "assistant", content: assistantContent });

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const result = await executeTool(tu.name);
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
        }
        currentMessages.push({ role: "user", content: toolResults });
      } else {
        send({ type: "done" });
        break;
      }
    }
  } catch (e) {
    send({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }

  res.end();
});

export default router;
