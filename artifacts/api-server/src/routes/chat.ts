import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import * as kalshi from "../lib/kalshiClient.js";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_BASE = `You are Kowalski, Ben Hamer's AI assistant inside BenAdmin — his unified control panel.
You have tools to fetch live data and interact with Kalshi directly (check positions, search markets, place and cancel orders).
Be direct and specific. No filler. Ben is a technical founder who knows his products well.
Current UTC time: ${new Date().toUTCString()}

IMPORTANT for Kalshi trading:
- Always confirm ticker, side, count, and price before placing any order
- Max position size: $20 per trade
- Only place orders when Ben explicitly confirms — never speculatively
- KALSHI_RULES.md on the droplet has full rules; use good judgment when placing orders`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "kalshi_get_stats",
    description: "Get Kalshi portfolio: balance, open positions with P&L, unrealized gain/loss, cash %",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "kalshi_get_positions",
    description: "Get all open Kalshi positions with current market prices and P&L",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "kalshi_search_markets",
    description: "Search open Kalshi markets by keyword. Returns ticker, title, yes/no prices, volume, close time.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term, e.g. 'GDP', 'Trump', 'CPI'" },
        limit: { type: "number", description: "Number of results (max 50, default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "kalshi_place_order",
    description: "Place a limit order on Kalshi. ONLY call this after Ben explicitly confirms the trade.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Market ticker, e.g. KXCPI-26APR-T0.6" },
        side: { type: "string", enum: ["yes", "no"], description: "Which side to buy" },
        count: { type: "number", description: "Number of contracts" },
        limitPrice: { type: "number", description: "Limit price in cents (0-100), e.g. 35 = 35 cents" },
        action: { type: "string", enum: ["buy", "sell"], description: "buy or sell" },
      },
      required: ["ticker", "side", "count", "limitPrice", "action"],
    },
  },
  {
    name: "kalshi_cancel_order",
    description: "Cancel an open Kalshi order by order ID",
    input_schema: {
      type: "object" as const,
      properties: {
        orderId: { type: "string", description: "The order ID to cancel" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "kalshi_get_open_orders",
    description: "Get all resting (open, unfilled) Kalshi orders",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_tars_snapshot",
    description: "Get Tars options bot status: account equity, P&L, win rate, engine status, open positions, recent analyses",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_stock_positions",
    description: "Get current options/stock positions and P&L from Tradier",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_instantly_metrics",
    description: "Get Instantly.ai cold email campaign metrics: sent, open rate, reply rate",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    // ── Kalshi tools ──────────────────────────────────────────────────────
    if (name === "kalshi_get_stats") {
      if (!process.env.KALSHI_PRIVATE_KEY) return JSON.stringify({ error: "KALSHI_PRIVATE_KEY not configured" });
      const stats = await kalshi.getStats();
      return JSON.stringify(stats, null, 2);
    }

    if (name === "kalshi_get_positions") {
      if (!process.env.KALSHI_PRIVATE_KEY) return JSON.stringify({ error: "KALSHI_PRIVATE_KEY not configured" });
      const positions = await kalshi.getPositions();
      return JSON.stringify(positions, null, 2);
    }

    if (name === "kalshi_search_markets") {
      if (!process.env.KALSHI_PRIVATE_KEY) return JSON.stringify({ error: "KALSHI_PRIVATE_KEY not configured" });
      const query = String(input.query ?? "");
      const limit = Number(input.limit ?? 10);
      const markets = await kalshi.searchMarkets(query, limit);
      return JSON.stringify(markets, null, 2);
    }

    if (name === "kalshi_place_order") {
      if (!process.env.KALSHI_PRIVATE_KEY) return JSON.stringify({ error: "KALSHI_PRIVATE_KEY not configured" });
      const result = await kalshi.placeOrder({
        ticker: String(input.ticker),
        side: input.side as "yes" | "no",
        count: Number(input.count),
        limitPrice: Number(input.limitPrice),
        action: (input.action as "buy" | "sell") ?? "buy",
      });
      return JSON.stringify(result, null, 2);
    }

    if (name === "kalshi_cancel_order") {
      if (!process.env.KALSHI_PRIVATE_KEY) return JSON.stringify({ error: "KALSHI_PRIVATE_KEY not configured" });
      await kalshi.cancelOrder(String(input.orderId));
      return JSON.stringify({ ok: true, cancelled: input.orderId });
    }

    if (name === "kalshi_get_open_orders") {
      if (!process.env.KALSHI_PRIVATE_KEY) return JSON.stringify({ error: "KALSHI_PRIVATE_KEY not configured" });
      const orders = await kalshi.getOpenOrders();
      return JSON.stringify(orders, null, 2);
    }

    // ── Tars ──────────────────────────────────────────────────────────────
    if (name === "get_tars_snapshot") {
      const tarsUrl = process.env.TARS_URL ?? "https://tars-ai.replit.app";
      const password = process.env.TARS_PASSWORD;
      if (!password) return JSON.stringify({ error: "TARS_PASSWORD not configured" });

      // Login
      const loginRes = await fetch(`${tarsUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(10_000),
      });
      const cookie = loginRes.headers.get("set-cookie") ?? "";
      const match = cookie.match(/tars_session=([^;]+)/);
      const sessionCookie = match ? `tars_session=${match[1]}` : "";

      const [account, metrics, engine, positions] = await Promise.all([
        fetch(`${tarsUrl}/api/account`, { headers: { Cookie: sessionCookie } }).then((r) => r.json()),
        fetch(`${tarsUrl}/api/metrics`, { headers: { Cookie: sessionCookie } }).then((r) => r.json()),
        fetch(`${tarsUrl}/api/engine/status`, { headers: { Cookie: sessionCookie } }).then((r) => r.json()),
        fetch(`${tarsUrl}/api/positions`, { headers: { Cookie: sessionCookie } }).then((r) => r.json()),
      ]);
      return JSON.stringify({ account, metrics, engine, positions }, null, 2);
    }

    // ── Tradier ───────────────────────────────────────────────────────────
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

    // ── Instantly ─────────────────────────────────────────────────────────
    if (name === "get_instantly_metrics") {
      const apiKey = process.env.INSTANTLY_API_KEY;
      if (!apiKey) return JSON.stringify({ error: "INSTANTLY_API_KEY not configured" });
      const r = await fetch("https://api.instantly.ai/api/v1/campaign/list?limit=20&skip=0", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      return JSON.stringify(await r.json(), null, 2);
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

router.post("/chat", async (req: Request, res: Response) => {
  const { messages, tabContext } = req.body as {
    messages: Anthropic.Messages.MessageParam[];
    tabContext?: { tab: string; data?: unknown };
  };

  if (!messages?.length) { res.status(400).json({ error: "No messages" }); return; }
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

    while (iterations < 6) {
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
      let toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
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
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(currentToolInput || "{}"); } catch { /* ok */ }
          toolUses.push({ ...currentToolUse, input: parsed });
          currentToolUse = null;
        } else if (event.type === "message_delta") {
          stopReason = event.delta.stop_reason ?? "";
        }
      }

      if (stopReason === "tool_use" && toolUses.length > 0) {
        send({ type: "tool_call", tools: toolUses.map((t) => t.name) });

        const assistantContent: Anthropic.Messages.ContentBlock[] = [];
        if (fullText) assistantContent.push({ type: "text", text: fullText });
        toolUses.forEach((t) =>
          assistantContent.push({ type: "tool_use", id: t.id, name: t.name, input: t.input })
        );
        currentMessages.push({ role: "assistant", content: assistantContent });

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const result = await executeTool(tu.name, tu.input);
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
