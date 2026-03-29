import { TRADING_RULES } from "./tradingRules.js";
import { logger } from "./logger.js";

export type AlertType = "TRADE_ENTERED" | "TRADE_CLOSED" | "HIGH_SCORE_SKIP" | "CIRCUIT_BREAKER";

interface TradeEnteredParams {
  ticker: string;
  direction: string;
  strike: number;
  expiry: string;
  contracts: number;
  entryPrice: string;
  stopPrice: string;
  t1Price: string;
  t2Price: string;
  score?: number;
  reasoning?: string;
}

interface TradeClosedParams {
  ticker: string;
  optionSymbol: string;
  closeReason: string;
  entryPrice: string;
  closePrice: string;
  pnlDollars?: string;
  pnlPct?: string;
}

interface HighScoreSkipParams {
  ticker: string;
  direction: string;
  score: number;
  reasoning: string;
  skipReason: string;
}

interface CircuitBreakerParams {
  reason: string;
  details?: string;
}

type AlertParams = TradeEnteredParams | TradeClosedParams | HighScoreSkipParams | CircuitBreakerParams;

function colorForType(type: AlertType): number {
  switch (type) {
    case "TRADE_ENTERED": return 0x00d26a;   // green
    case "TRADE_CLOSED": return 0xef4444;    // red
    case "HIGH_SCORE_SKIP": return 0xf59e0b; // yellow
    case "CIRCUIT_BREAKER": return 0x6366f1; // purple
  }
}

function buildEmbed(type: AlertType, params: AlertParams): object {
  const color = colorForType(type);
  const tag = `<@${TRADING_RULES.benDiscordId}>`;
  const shouldTag = type === "TRADE_ENTERED" || type === "TRADE_CLOSED";

  switch (type) {
    case "TRADE_ENTERED": {
      const p = params as TradeEnteredParams;
      return {
        embeds: [{
          title: `🟢 TRADE ENTERED — ${p.ticker} ${p.direction.toUpperCase()}`,
          color,
          fields: [
            { name: "Strike / Expiry", value: `$${p.strike} · ${p.expiry}`, inline: true },
            { name: "Contracts", value: String(p.contracts), inline: true },
            { name: "Entry", value: `$${p.entryPrice}`, inline: true },
            { name: "Stop", value: `$${p.stopPrice}`, inline: true },
            { name: "T1", value: `$${p.t1Price}`, inline: true },
            { name: "T2", value: `$${p.t2Price}`, inline: true },
            ...(p.score != null ? [{ name: "Confidence", value: `${p.score}/100`, inline: true }] : []),
            ...(p.reasoning ? [{ name: "Reasoning", value: p.reasoning.slice(0, 500) }] : []),
          ],
          timestamp: new Date().toISOString(),
        }],
        content: shouldTag ? tag : undefined,
      };
    }
    case "TRADE_CLOSED": {
      const p = params as TradeClosedParams;
      const pnl = p.pnlDollars ? parseFloat(p.pnlDollars) : 0;
      const isWin = pnl >= 0;
      return {
        embeds: [{
          title: `${isWin ? "✅" : "❌"} TRADE CLOSED — ${p.ticker} (${p.closeReason})`,
          color: isWin ? 0x00d26a : 0xef4444,
          fields: [
            { name: "Symbol", value: p.optionSymbol, inline: true },
            { name: "Entry", value: `$${p.entryPrice}`, inline: true },
            { name: "Close", value: `$${p.closePrice}`, inline: true },
            ...(p.pnlDollars ? [{ name: "P&L", value: `${isWin ? "+" : ""}$${p.pnlDollars} (${p.pnlPct ?? "?"}%)`, inline: true }] : []),
          ],
          timestamp: new Date().toISOString(),
        }],
        content: shouldTag ? tag : undefined,
      };
    }
    case "HIGH_SCORE_SKIP": {
      const p = params as HighScoreSkipParams;
      return {
        embeds: [{
          title: `🔵 HIGH-CONVICTION SKIP — ${p.ticker} ${p.direction.toUpperCase()}`,
          color,
          fields: [
            { name: "Score", value: `${p.score}/100`, inline: true },
            { name: "Skip Reason", value: p.skipReason, inline: true },
            { name: "Reasoning", value: p.reasoning.slice(0, 800) },
          ],
          timestamp: new Date().toISOString(),
        }],
      };
    }
    case "CIRCUIT_BREAKER": {
      const p = params as CircuitBreakerParams;
      return {
        embeds: [{
          title: "⚡ CIRCUIT BREAKER TRIGGERED",
          color,
          fields: [
            { name: "Reason", value: p.reason },
            ...(p.details ? [{ name: "Details", value: p.details }] : []),
          ],
          timestamp: new Date().toISOString(),
        }],
      };
    }
  }
}

export async function sendTarsAlert(type: AlertType, params: AlertParams): Promise<void> {
  const webhook = TRADING_RULES.discordWebhook;
  if (!webhook) {
    logger.warn("TARS_DISCORD_WEBHOOK not set — skipping Discord alert");
    return;
  }

  const body = buildEmbed(type, params);

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.error({ status: res.status }, "Discord webhook failed");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send Discord alert");
  }
}
